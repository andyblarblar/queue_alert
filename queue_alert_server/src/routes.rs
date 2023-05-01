/*
 * Copyright (c) 2021. Andrew Ealovega
 */

use crate::models::Registration;
use actix_web::web;
use actix_web::{get, post, HttpResponse, Responder, Result};
use std::sync::Arc;
use web_push::*;

/// Routes for registering users to push.
pub mod registration {
    use super::*;
    use crate::app::Application;

    /// Returns the current number of subscribed users.
    #[get("/userCount")]
    pub async fn get_current_user_count(app: web::Data<Arc<Application>>) -> impl Responder {
        let app = app.into_inner();

        let subs = app.subs.read().await;
        subs.len().to_string()
    }

    /// Returns the current VAPID public key.
    #[get("/vapidPublicKey")]
    pub async fn vapid_public_key(app: web::Data<Arc<Application>>) -> impl Responder {
        let app = app.into_inner();
        let public = app.keys.1.clone();

        public.0
    }

    /// Adds the subscription to the vec of clients to push. Updates registration if already registered, as config can change.
    #[post("/register")]
    pub async fn register(
        subscription: web::Json<Registration>,
        app: web::Data<Arc<Application>>,
    ) -> Result<impl Responder> {
        let subscription = subscription.into_inner();

        //Check if already registered
        let mut wrt_subs = app.subs.write().await;
        let exists = wrt_subs.binary_search_by(|s| s.sub.endpoint.cmp(&subscription.sub.endpoint));

        match exists {
            //Already registered, update
            Ok(idx) => {
                log::info!("Updating existing user {}", subscription.sub.endpoint);
                wrt_subs[idx] = subscription;
                Ok(HttpResponse::Ok())
            }
            //Register in sorted order
            Err(idx) => {
                log::info!("Registered new user {}", subscription.sub.endpoint);
                //Add client to vec of clients to send push to
                wrt_subs.insert(idx, subscription);

                Ok(HttpResponse::Ok())
            }
        }
    }

    /// Removes the subscription from the server, stopping push notifications. Clients still need to unsub from the
    /// push service on their end.
    #[post("/unregister")]
    pub async fn unregister(
        subscription: web::Json<SubscriptionInfo>,
        app: web::Data<Arc<Application>>,
    ) -> impl Responder {
        let subscription = subscription.into_inner();

        //Remove client based upon their endpoint, which is unique.
        let mut wrt_subs = app.subs.write().await;
        let exists = wrt_subs.binary_search_by(|s| s.sub.endpoint.cmp(&subscription.endpoint));

        match exists {
            Ok(idx) => {
                wrt_subs.remove(idx);
                HttpResponse::Ok().finish()
            }
            //sub isnt registered
            Err(_) => {
                HttpResponse::BadRequest().body("Subscription was not registered with queue alert")
            }
        }
    }
}

pub mod queue {
    use super::*;
    use crate::app::Application;
    use queue_times::client::QueueTimesClient;
    use std::collections::BTreeMap;

    ///Responds with a JSON object of {name, park_url}, sorted by name.
    #[get("/allParks")]
    pub async fn get_all_parks(app: web::Data<Arc<Application>>) -> Result<impl Responder> {
        let app = app.into_inner();
        let res = app.queue_client.get_park_urls().await;

        match res {
            Ok(mut map) => {
                //Sort map by name
                let map = map
                    .drain()
                    .map(|(n, u)| (n, u.to_string()))
                    .collect::<BTreeMap<String, String>>();
                Ok(HttpResponse::Ok().json(map))
            }
            Err(err) => Ok(HttpResponse::InternalServerError().body(format!("{}", err))),
        }
    }

    /// Used for extracting `...?url=...` queries.
    #[derive(serde::Deserialize)]
    pub struct UrlQuery {
        pub url: String,
    }

    ///Responds with a sorted JSON list of ride wait times for the park at the passed url. The url is validated before being accepted.
    ///
    /// # Example
    /// `GET /parkWaitTimes?url=...`
    #[get("/parkWaitTimes")]
    pub async fn get_park_wait_times(
        app: web::Data<Arc<Application>>,
        url: web::Query<UrlQuery>,
    ) -> impl Responder {
        use url::Url;

        let app = app.into_inner();

        //Validate url
        let url = Url::parse(url.into_inner().url.as_str());
        match &url {
            Ok(url) => {
                //Validate url is to queue_times, else consumers could have us download anything :/
                match url.domain() {
                    None => {
                        return HttpResponse::BadRequest().body("Non queue-times url passed.");
                    }
                    Some(domain) => {
                        if domain != "queue-times.com" {
                            return HttpResponse::BadRequest().body("Non queue-times url passed.");
                        }
                    }
                }
            }
            Err(_) => {
                return HttpResponse::BadRequest().body("Bad Url passed.");
            }
        }
        let url = url.unwrap();

        let res = app.queue_client.get_ride_times(url).await;

        match res {
            Ok(mut times) => {
                times.sort();
                HttpResponse::Ok().json(times)
            }
            Err(err) => HttpResponse::InternalServerError().body(format!("{}", err)),
        }
    }
}
