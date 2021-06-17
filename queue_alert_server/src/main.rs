/*
 * Copyright (c) 2021. Andrew Ealovega
 */

mod routes;
mod models;

use actix_web::*;
use actix_files::{Files};
use simplelog::{Config, LevelFilter};
use actix_web::middleware::Logger;
use std::sync::Arc;
use std::io::Read;
use openssl::bn::BigNumContext;


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    simplelog::SimpleLogger::init(LevelFilter::Debug, Config::default()).unwrap();

    //Load keys
    let keys = load_private_key();
    match keys {
        Ok(_) => {}
        Err(why) => {
            log::error!("Couldn't load private key. Make sure to have a PEM pk in the file: './private_key.pem'.");
            return std::io::Result::Err(why)
        }
    }
    let keys = keys.unwrap();

    //All subscribed users, to be sorted by endpoint to allow for binary searches
    let subs = Arc::new(routes::RWVec::new(Vec::new()));

    HttpServer::new(move || {
        App::new()
            .wrap(Logger::new("%a %U %s"))
            .data(subs.clone())//Clients to push to
            .data(keys.clone())
            //Begin endpoints
            .service(routes::vapid_public_key)
            .service(routes::register)
            .service(routes::unregister)
            .service(routes::ping)//TODO remove this
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