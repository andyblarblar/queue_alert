/*
 * Copyright (c) 2021. Andrew Ealovega
 */

use actix_web::{Responder, HttpResponse, get, post, Result};
use actix_web::web;
use web_push::*;
use std::sync::{Arc};
use tokio::sync::RwLock;
use crate::models::Keys;
use std::ops::Deref;
use crate::routes::registration::Registration;

pub type RWVec = RwLock<Vec<Registration>>;
pub type QClient = queue_times::client::CachedClient<queue_times::client::Client>;

/// Routes for registering users to push.
pub mod registration {
    use super::*;

    /// Returns the current VAPID public key.
    #[get("/vapidPublicKey")]
    pub async fn vapid_public_key(keys: web::Data<Keys>) -> impl Responder {
        let arc = keys.into_inner();
        let (_, public) = arc.deref();

        public.0.clone()
    }

    /// A clients registration.
    #[derive(serde::Deserialize, serde::Serialize)]
    pub struct Registration {
        /// Push API endpoint info.
        pub sub: SubscriptionInfo,
        /// The park the user is listening to.
        pub park: String
    }

    /// Adds the subscription to the vec of clients to push.
    #[post("/register")]
    pub async fn register(subscription: web::Json<Registration>, subs: web::Data<Arc<RWVec>>) -> Result<impl Responder> {
        let subscription = subscription.into_inner();

        //Check if already registered. Get as write to avoid race condition on index to insert to.
        let mut wrt_subs = subs.write().await;
        let exists = wrt_subs.binary_search_by(|s| s.sub.endpoint.cmp(&subscription.sub.endpoint));

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
    pub async fn unregister(subscription: web::Json<SubscriptionInfo>, subs: web::Data<Arc<RWVec>>) -> impl Responder {
        let subscription = subscription.into_inner();

        //Remove client based upon their endpoint, which is unique. Get as write to avoid race condition on index.
        let mut wrt_subs = subs.write().await;
        let exists = wrt_subs.binary_search_by(|s| s.sub.endpoint.cmp(&subscription.endpoint));

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
}

pub mod queue {
    use super::*;
    use queue_times::client::QueueTimesClient;
    use std::collections::{BTreeMap};

    ///Responds with a JSON object of {name, park_url}, sorted by name.
    #[get("/allParks")]
    pub async fn get_all_parks(client: web::Data<Arc<QClient>>) -> Result<impl Responder> {
        let client = client.into_inner();
        let res = client.get_park_urls().await;

        match res {
            Ok(mut map) => {
                //Sort map by name
                let map = map.drain().map(|(n,u)| (n,u.to_string())).collect::<BTreeMap<String,String>>();
                Ok(HttpResponse::Ok().json(map))
            }
            Err(err) => {
                return Ok(HttpResponse::InternalServerError().body(format!("{}",err)))
            }
        }
    }

    /// Used for extracting `...?url=...` queries.
    #[derive(serde::Deserialize)]
    pub struct UrlQuery {
        pub url: String
    }

    ///Responds with a sorted JSON list of ride wait times for the park at the passed url. The url is validated before being accepted.
    ///
    /// # Example
    /// `GET /parkWaitTimes?url=...`
    #[get("/parkWaitTimes")]
    pub async fn get_park_wait_times(client: web::Data<Arc<QClient>>, url: web::Query<UrlQuery>) -> impl Responder {
        use url::Url;

        let client = client.into_inner();

        //Validate url
        let url = Url::parse(url.into_inner().url.as_str());
        match &url {
            Ok(url) => {
                //Validate url is to queue_times, else consumers could have us download anything :/
                match url.domain() {
                    None => {
                        return HttpResponse::BadRequest().body("Non queue-times url passed.")
                    }
                    Some(domain) => {
                        if domain != "queue-times.com" {
                            return HttpResponse::BadRequest().body("Non queue-times url passed.")
                        }
                    }
                }
            }
            Err(_) => {
                return HttpResponse::BadRequest().body("Bad Url passed.")
            }
        }
        let url = url.unwrap();

        let res = client.get_ride_times(url).await;

        match res {
            Ok(mut times) => {
                times.sort();
                HttpResponse::Ok().json(times)
            }
            Err(err) => {
                return HttpResponse::InternalServerError().body(format!("{}",err))
            }
        }
    }
}