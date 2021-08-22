/*
 * Copyright (c) 2021. Andrew Ealovega
 */

mod models;
mod routes;

use actix_files::Files;
use actix_web::middleware::Logger;
use actix_web::web::Data;
use actix_web::*;
use iis::get_port;
use queue_times::client::QueueTimesClient;
use simplelog::{ConfigBuilder, LevelFilter};
use std::io::Read;
use std::sync::Arc;
use web_push::{
    ContentEncoding, PartialVapidSignatureBuilder, VapidSignatureBuilder, WebPushClient,
    WebPushError, WebPushMessageBuilder,
};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let config = ConfigBuilder::default()
        .add_filter_ignore_str("html5ever")
        .add_filter_ignore_str("selectors::matching")
        .build();
    simplelog::SimpleLogger::init(
        if cfg!(feature = "prod") {
            LevelFilter::Info
        } else {
            LevelFilter::Debug
        },
        config,
    )
    .unwrap();

    //Get port for listening. IIS has its own port.
    let port: String;
    if cfg!(feature = "host_iis") {
        port = get_port();
        log::info!("Got port {} from IIS", port)
    } else {
        port = "8080".to_string();
        log::info!(
            "Not configured to use any server, defaulting to port: {}",
            port
        )
    }

    //Load keys
    let keys = load_private_key();
    if let Err(why) = keys {
        log::error!("Couldn't load private key. Make sure to have a PEM pk in the file: './private_key.pem'. Generate with: `openssl ecparam -genkey -name prime256v1 -out private_key.pem`");
        return std::io::Result::Err(why);
    }
    let keys = keys.unwrap();

    //All subscribed users, to be sorted by endpoint to allow for binary searches
    let subs = Arc::new(routes::RWVec::new(Vec::new()));
    //Shared caching queue times client
    let queue_client = Arc::new(queue_times::client::CachedClient::default());
    //Client for sending push notifications
    let push_client = Arc::new(WebPushClient::new().unwrap());

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
        let timer_push = push_client.clone();

        let tok = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        tok.block_on(async move {
            {
                let subs = timer_subs2.read().await;

                if subs.is_empty() {
                    return;
                }
            }

            let parks = timer_client2.get_park_urls().await;

            if let Err(why) = &parks {
                log::error!("While getting parks: {}",why);
                return;
            }
            let parks = parks.unwrap();

            let subs = timer_subs2.read().await;

            log::info!("pushing to {} clients", subs.len());

            //Push to all clients
            for sub in subs.iter() {
                let url = parks.get(&sub.park);
                if url.is_none() {
                    log::error!("Submitted invalid park {}",sub.park);
                    continue;
                }

                let rides = timer_client2.get_ride_times(url.unwrap().to_owned()).await;

                if let Err(why) = rides {
                    log::error!("While getting rides: {}",why);
                    continue;
                }

                let mut builder = WebPushMessageBuilder::new(&sub.sub).unwrap();

                let content = serde_json::to_string(&rides.unwrap()).unwrap();

                log::debug!("Content size: {} bytes", content.len());

                //*Must* set vapid signature, else error
                builder.set_vapid_signature(timer_keys2.2.clone().add_sub_info(&sub.sub).build().unwrap());
                builder.set_payload(ContentEncoding::Aes128Gcm, content.as_bytes());

                let message = builder.build();

                //Message will fail if too large.
                if let Err(why) = message {
                    if why == WebPushError::PayloadTooLarge {
                        log::error!("Payload for message was too large!");
                    }
                } else if let Err(why) = timer_push.send(message.unwrap()).await {
                    log::error!("When sending webpush to client: {}", why);
                }
            }
        });
    });

    HttpServer::new(move || {
        //Enable cors only in prod
        let cors = actix_cors::Cors::permissive(); //TODO cors breaks prod
                                                   //if cfg!(feature = "prod")
                                                   //{ actix_cors::Cors::default() } else { actix_cors::Cors::permissive() };

        App::new()
            .wrap(cors)
            .wrap(Logger::new("%{r}a %U %s"))
            .app_data(Data::new(subs.clone())) //Clients to push to
            .app_data(Data::new((keys.0.clone(), keys.1.clone())))
            .app_data(Data::new(queue_client.clone()))
            //Begin endpoints
            .service(routes::registration::vapid_public_key)
            .service(routes::registration::register)
            .service(routes::registration::unregister)
            .service(routes::registration::get_current_user_count)
            .service(routes::queue::get_all_parks)
            .service(routes::queue::get_park_wait_times)
            .service(Files::new("/", "./www").index_file("index.html")) //Must be last, serves static site
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}

/// Loads a PEM private key from a local file './private_key.pem', and generates a public key
/// from it. Both keys are base64URL encoded. A partial VAPID object is also returned.
///
/// # Generation
/// `openssl ecparam -genkey -name prime256v1 -out private_key.pem`
fn load_private_key() -> std::io::Result<(
    models::PrivateKey,
    models::PublicKey,
    PartialVapidSignatureBuilder,
)> {
    let mut file = std::fs::File::open("./private_key.pem")?;
    let mut str = String::new();

    file.read_to_string(&mut str)?;

    let sig = VapidSignatureBuilder::from_pem_no_sub(str.as_bytes()).unwrap();

    let key_bytes = sig.get_public_key();

    let final_pub = base64::encode_config(&key_bytes, base64::URL_SAFE_NO_PAD);

    log::info!("Using pub key: {}", final_pub);

    Ok((models::PrivateKey(str), models::PublicKey(final_pub), sig))
}
