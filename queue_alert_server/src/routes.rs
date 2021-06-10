/*
 * Copyright (c) 2021. Andrew Ealovega
 */

use actix_web::{Responder, HttpResponse, get, post, Result};
use actix_web::web;
use web_push::*;
use std::sync::{RwLock, Arc};

pub type RWVec = RwLock<Vec<SubscriptionInfo>>;

/// VAPID public key to be used with the JS client.
static PUB_KEY: &str = "BMRl2A0MtIKCETR-kTY9jLD8Kk3rxBZZ6z61BQ845_vasL7RDFnwrwm5axLxnCgfR0StA8bL1PSvzs8l7Pox6Bo=";

//TODO refactor into modules based upon api use

/// Returns the current VAPID public key.
#[get("/vapidPublicKey")]
pub async fn vapid_public_key() -> impl Responder {
    PUB_KEY
}

/// Adds the subscription to the vec of clients to push.
#[post("/register")]
pub async fn register(subscription: web::Json<SubscriptionInfo>, subs: web::Data<Arc<RWVec>> ) -> Result<impl Responder> {
    let subscription = subscription.into_inner();

    //Check if already registered. Get as write to avoid race condition on index to insert to.
    let mut wrt_subs = subs.write().unwrap();
    let exists = wrt_subs.binary_search_by(|s| s.endpoint.cmp(&subscription.endpoint));

    match exists {
        //Already registered
        Ok(_) => {
            Ok(HttpResponse::Ok())
        },
        //Register in sorted order
        Err(idx) => {
            //Add client to vec of clients to send push to
            wrt_subs.insert(idx, subscription);

            Ok(HttpResponse::Ok())
        }
    }
}

/// Removes the subscription from the server, stopping push notifications. Clients still need to unsub from the
/// push service on their end.
#[post("/unregister")]
pub async fn unregister(subscription: web::Json<SubscriptionInfo>, subs: web::Data<Arc<RWVec>> ) -> impl Responder {
    let subscription = subscription.into_inner();

    //Remove client based upon their endpoint, which is unique. Get as write to avoid race condition on index.
    let mut wrt_subs = subs.write().unwrap();
    let exists = wrt_subs.binary_search_by(|s| s.endpoint.cmp(&subscription.endpoint));

    match exists {
        Ok(idx) => {
            wrt_subs.remove(idx);
            HttpResponse::Ok().finish()
        },
        //sub isnt registered
        Err(_) => {
            HttpResponse::BadRequest().body("Subscription was not registered with queue alert")
        }
    }
}

///Demo function used to test notifications
#[get("/ping")]
pub async fn ping(subs: web::Data<Arc<RWVec>> ) -> impl Responder {
    let subs = subs.read().unwrap();

    let client = WebPushClient::new();

    let private = std::fs::File::open("./private_key.pem").unwrap();

    for sub in subs.iter() {
        let mut builder = WebPushMessageBuilder::new(&sub).unwrap();
        let content = "Pong!".as_bytes();

        //*Must* set vapid signature, else error
        builder.set_vapid_signature(VapidSignatureBuilder::from_pem(&private, &sub).unwrap().build().unwrap());
        builder.set_payload(ContentEncoding::AesGcm, content);

        client.send(builder.build().unwrap()).await.unwrap();
    }

    HttpResponse::Ok()
}