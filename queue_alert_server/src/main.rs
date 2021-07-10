/*
 * Copyright (c) 2021. Andrew Ealovega
 */

mod routes;
mod models;

use actix_web::*;
use actix_files::{Files};
use simplelog::{LevelFilter, ConfigBuilder};
use actix_web::middleware::Logger;
use std::sync::Arc;
use std::io::Read;
use openssl::bn::BigNumContext;
use queue_times::client::QueueTimesClient;
use web_push::{WebPushClient, WebPushMessageBuilder, VapidSignatureBuilder, ContentEncoding};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let config = ConfigBuilder::default().add_filter_ignore_str("html5ever").add_filter_ignore_str("selectors::matching").build();
    simplelog::SimpleLogger::init(LevelFilter::Debug, config).unwrap();

    //Load keys
    let keys = load_private_key();
    match keys {
        Ok(_) => {}
        Err(why) => {
            log::error!("Couldn't load private key. Make sure to have a PEM pk in the file: './private_key.pem'. Generate with: `openssl ecparam -genkey -name prime256v1 -out private_key.pem`");
            return std::io::Result::Err(why)
        }
    }
    let keys = keys.unwrap();

    //All subscribed users, to be sorted by endpoint to allow for binary searches
    let subs = Arc::new(routes::RWVec::new(Vec::new()));
    //Shared caching queue times client
    let queue_client = Arc::new(queue_times::client::CachedClient::default());

    //Setup timer to send push notifications
    let timer_subs = subs.clone();
    let timer_client = queue_client.clone();
    let timer_keys = keys.clone();
    let timer = timer::Timer::new();
    let _timer_scope /*RAII type*/ = timer.schedule_repeating(chrono::Duration::seconds(30), move || {
        //Clone again to preserve FnMut
        let timer_subs2 = timer_subs.clone();
        let timer_client2 = timer_client.clone();
        let timer_keys2 = timer_keys.clone();

        let tok = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        tok.block_on(async move {
            {
                let subs = timer_subs2.read().await;

                if subs.is_empty() {
                    return
                }
            }

            log::debug!("pushing to clients");
            let parks = timer_client2.get_park_urls().await;

            if let Err(why) = &parks {
                log::error!("While getting parks: {}",why);
                return
            }
            let parks = parks.unwrap();

            //Send push message to registered clients
            let client = WebPushClient::new();

            let subs = timer_subs2.read().await;

            //Push to all clients
            for sub in subs.iter() {
                let url = parks.get(&sub.park);
                if url.is_none() {continue}

                let rides = timer_client2.get_ride_times(url.unwrap().to_owned()).await;

                if let Err(why) = rides {
                    log::error!("While getting rides: {}",why);
                    continue
                }

                let mut builder = WebPushMessageBuilder::new(&sub.sub).unwrap();

                let content = serde_json::to_string(&rides.unwrap()).unwrap(); //It seems web push needs utf-8 bytes, so json it is. Cant even compress :/

                log::debug!("Content size: {} bytes", content.len());

                //*Must* set vapid signature, else error
                builder.set_vapid_signature(VapidSignatureBuilder::from_pem(timer_keys2.0.0.as_bytes(), &sub.sub).unwrap().build().unwrap());
                builder.set_payload(ContentEncoding::AesGcm, content.as_bytes());

                if let Err(why) = client.send(builder.build().unwrap()).await {
                    log::error!("When sending webpush to client: {}", why);
                }
            }
        });
    });

    HttpServer::new(move || {
        let cors = actix_cors::Cors::permissive();//TODO change for prod

        App::new()
            .wrap(cors)
            .wrap(Logger::new("%a %U %s"))
            .data(subs.clone())//Clients to push to
            .data(keys.clone())
            .data(queue_client.clone())
            //Begin endpoints
            .service(routes::registration::vapid_public_key)
            .service(routes::registration::register)
            .service(routes::registration::unregister)
            .service(routes::queue::get_all_parks)
            .service(routes::queue::get_park_wait_times)
            .service(Files::new("/","./www").index_file("index.html"))//Must be last, serves static site
    })
        .bind(("0.0.0.0", 8080))?
        .run()
        .await
}

/// Loads a PEM private key from a local file './private_key.pem', and generates a public key
/// from it.
///
/// # Generation
/// `openssl ecparam -genkey -name prime256v1 -out private_key.pem`
fn load_private_key() -> std::io::Result<(models::PrivateKey,models::PublicKey)> {
    let mut file = std::fs::File::open("./private_key.pem")?;
    let mut str = String::new();

    file.read_to_string(&mut str)?;

    use openssl::ec::*;

    //Load private
    let pk = EcKey::private_key_from_pem(str.as_bytes()).unwrap();
    let pub_k = pk.public_key();

    //Create combined key
    let key = EcKey::from_private_components(&EcGroup::from_curve_name(openssl::nid::Nid::X9_62_PRIME256V1).unwrap(), pk.private_key(),pub_k ).unwrap();
    //Base64 encode pub key
    let mut ctx = BigNumContext::new().unwrap();
    let keybytes = key.public_key()
        .to_bytes(&EcGroup::from_curve_name(openssl::nid::Nid::X9_62_PRIME256V1).unwrap(), PointConversionForm::UNCOMPRESSED, &mut ctx)
        .unwrap();
    let final_pub = base64::encode_config(&keybytes, base64::URL_SAFE_NO_PAD);

    log::info!("Using pub key: {}", final_pub);

    Ok((models::PrivateKey(str),models::PublicKey(final_pub)))
}
