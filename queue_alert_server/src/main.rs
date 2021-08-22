/*
 * Copyright (c) 2021. Andrew Ealovega
 */

use std::io::{Read, Write};
use std::sync::Arc;

use actix_files::Files;
use actix_web::middleware::Logger;
use actix_web::web::Data;
use actix_web::*;
use flate2::write::GzEncoder;
use flate2::Compression;
use iis::get_port;
use queue_times::client::QueueTimesClient;
use simplelog::{ConfigBuilder, LevelFilter};
use web_push::{
    ContentEncoding, PartialVapidSignatureBuilder, VapidSignatureBuilder, WebPushClient,
    WebPushError, WebPushMessageBuilder,
};

mod models;
mod routes;

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

                log::info!("JSON used: {}", content);

                //Compress JSON with gzip
                let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
                encoder.write_all(content.as_bytes()).unwrap();
                let content = encoder.finish().unwrap();
                //URLbase64 encode so the browser accepts the bytes //TODO change to reuse string to avoid allocs. It doesnt seem to be base64 encodig right.
                let content = base64::encode(&content);

                log::info!("Encoded used: {}", content);
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

#[cfg(test)]
mod test {
    use std::io::{Write, Read};

    use flate2::write::GzEncoder;
    use flate2::Compression;
    use serde_json::Value;
    use flate2::read::GzDecoder;

    fn get_content() -> Value {
        serde_json::json!([{"name":"Blue Streak","status":"Closed"},{"name":"Cedar Creek Mine Ride","status":"Closed"},{"name":"Corkscrew","status":"Closed"},{"name":"GateKeeper","status":"Closed"},{"name":"Gemini","status":"Closed"},{"name":"Iron Dragon","status":"Closed"},{"name":"Magnum XL-200","status":"Closed"},{"name":"Maverick","status":"Closed"},{"name":"Millennium Force","status":"Closed"},{"name":"Pipe Scream","status":"Closed"},{"name":"Raptor","status":"Closed"},{"name":"Rougarou","status":"Closed"},{"name":"Steel Vengeance","status":"Closed"},{"name":"Top Thrill Dragster","status":"Closed"},{"name":"Valravn","status":"Closed"},{"name":"Wicked Twister","status":"Closed"},{"name":"Wilderness Run","status":"Closed"},{"name":"Woodstock Express","status":"Closed"},{"name":"4x4's","status":"Closed"},{"name":"Antique Cars","status":"Closed"},{"name":"Cadillac Cars","status":"Closed"},{"name":"Charlie Brown's Wind-Up","status":"Closed"},{"name":"Flying Ace Balloon Race","status":"Closed"},{"name":"Giant Wheel","status":"Closed"},{"name":"Midway Carousel","status":"Closed"},{"name":"Peanuts 500","status":"Closed"},{"name":"Peanuts Road Rally","status":"Closed"},{"name":"Snoopy's Deep Sea Divers","status":"Closed"},{"name":"Snoopy's Express Railroad","status":"Closed"},{"name":"Tilt-A-Whirl","status":"Closed"},{"name":"Woodstock's Whirlybirds","status":"Closed"},{"name":"Dune Buggies","status":"Closed"},{"name":"Helicopters","status":"Closed"},{"name":"Joe Cool's Dodgem School","status":"Closed"},{"name":"Motorcycles","status":"Closed"},{"name":"Police Cars","status":"Closed"},{"name":"Rock, Spin, and Turn","status":"Closed"},{"name":"Roto Whip","status":"Closed"},{"name":"Sky Fighters","status":"Closed"},{"name":"Snoopy's Space Race","status":"Closed"},{"name":"Space Age","status":"Closed"},{"name":"Cedar Downs Racing Derby","status":"Closed"},{"name":"Dodgem","status":"Closed"},{"name":"Matterhorn","status":"Closed"},{"name":"MaXair","status":"Closed"},{"name":"Monster","status":"Closed"},{"name":"Power Tower","status":"Closed"},{"name":"Scrambler","status":"Closed"},{"name":"Skyhawk","status":"Closed"},{"name":"SlingShot","status":"Closed"},{"name":"Super Himalaya","status":"Closed"},{"name":"Thunder Canyon","status":"Closed"},{"name":"Tiki Twirl","status":"Closed"},{"name":"Troika","status":"Closed"},{"name":"Fisherman's Fury","status":"Open"}])
    }

    #[test]
    fn test_compress_base64() {
        let content = get_content().to_string();

        //Compress JSON with gzip
        let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
        encoder.write_all(content.as_bytes()).unwrap();
        let content = encoder.finish().unwrap();
        //URLbase64 encode so the browser accepts the bytes
        let content = base64::encode(&content);

        println!("encoded: {}", content);

        assert!(content.as_bytes().len() < 4000);
        let un_based = base64::decode(&content).unwrap();

        let mut decoder = GzDecoder::new(&*un_based);
        assert!(decoder.header().is_some());

        let mut new_content = String::new();
        decoder.read_to_string(&mut new_content).unwrap();

        assert_eq!(new_content, get_content().to_string())
    }
}
