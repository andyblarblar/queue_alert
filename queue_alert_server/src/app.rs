use crate::models::{Keys, RideStatus};
use crate::registration::RegistrationRepository;
use flate2::write::GzEncoder;
use flate2::Compression;
use queue_times::client::QueueTimesClient;
use std::io::Write;
use std::time::Duration;
use web_push::{ContentEncoding, WebPushClient, WebPushError, WebPushMessageBuilder};

/// Application state.
///
/// Locks are fragmented across each field, so this struct does not need locking.
pub struct Application {
    /// All client registrations
    pub subs: RegistrationRepository,
    /// Queue times scraper
    pub queue_client: queue_times::client::CachedClient<queue_times::client::Client>,
    /// Web push client
    pub push_client: WebPushClient,
    /// ECDH keys used for vapid
    pub keys: Keys,
}

impl Application {
    pub fn new(
        subs: RegistrationRepository,
        queue_client: queue_times::client::CachedClient<queue_times::client::Client>,
        push_client: WebPushClient,
        keys: Keys,
    ) -> Self {
        Self {
            subs,
            queue_client,
            push_client,
            keys,
        }
    }

    /// Spins infinitely, sending push notifications to registered clients if their ride is ready.
    pub async fn push_loop(&self) {
        let mut timer = tokio::time::interval(Duration::from_secs(60));

        loop {
            timer.tick().await;

            self.push_to_clients().await;
        }
    }

    /// Sends notifications to clients if their ride is ready.
    async fn push_to_clients(&self) {
        //Skip if no subscribers
        if self.subs.get_current_user_count() == 0 {
            return;
        }

        let parks = self.queue_client.get_park_urls().await;

        if let Err(why) = &parks {
            log::error!("While getting parks: {}", why);
            return;
        }
        let parks = parks.unwrap();

        let subs = &self.subs;
        //Subs to remove after a send fails. Endpoints are unique, so they are used as an ID.
        let mut subs_to_remove: Vec<String> = Vec::new();

        log::info!(
            "checking if we should push to {} clients",
            subs.get_current_user_count()
        );

        //Push to all clients, if they have a ride ready
        for sub in subs.cache.iter() {
            let url = parks.get(&sub.config.0);
            if url.is_none() {
                log::error!("Submitted invalid park {}", sub.config.0);
                continue;
            }

            //Get the relevant rides for this subscription
            let rides = self
                .queue_client
                .get_ride_times(url.unwrap().to_owned())
                .await;

            if let Err(why) = rides {
                log::error!("While getting rides: {}", why);
                continue;
            }
            let rides = rides.unwrap();

            // Get all rides to send, which are all rides the client will alert on. This is done so we dont send a push where the client will not notify.
            let rides = rides.iter()
                .filter_map(|r| sub.config.1.iter().find(|rc| rc.ride_name == r.name).map(|rc| (rc, r)))
                .filter(|(ride_conf, ride_stat)| {
                    log::debug!("config: {:?} server_time: {:?}", ride_conf.alert_on, ride_stat.status);
                    // Only keep rides the user will alert on
                    match ride_conf.alert_on {
                        RideStatus::Open => !matches!(ride_stat.status, queue_times::model::RideStatus::Closed),
                        RideStatus::Closed => matches!(ride_stat.status, queue_times::model::RideStatus::Closed),
                        RideStatus::Wait(conf_t) => matches!(ride_stat.status, queue_times::model::RideStatus::Wait(stat_t) if conf_t >= stat_t)
                    }
                })
                // Reduce back to the ride-statuses we want to send to the client
                .map(|(_, rs)| rs)
                .collect::<Vec<_>>();

            // If nothing to send to client, continue.
            if rides.is_empty() {
                continue;
            }

            let mut builder = WebPushMessageBuilder::new(&sub.sub).unwrap();

            let content = serde_json::to_string(&rides).unwrap();

            //Compress JSON with gzip
            let mut encoder = GzEncoder::new(Vec::new(), Compression::best());
            encoder.write_all(content.as_bytes()).unwrap();
            let content = encoder.finish().unwrap();

            //Web push will reject non text payloads, so base64 encode
            let content = base64::encode(&content);

            log::debug!("Content size: {} bytes", content.len());

            //*Must* set vapid signature, else the push will be rejected
            builder
                .set_vapid_signature(self.keys.2.clone().add_sub_info(&sub.sub).build().unwrap());
            builder.set_payload(ContentEncoding::Aes128Gcm, content.as_bytes());

            let message = builder.build();

            //Message will fail if too large.
            if let Err(why) = message {
                if why == WebPushError::PayloadTooLarge {
                    log::error!("Payload for message was too large!");
                }
            }
            //Send the message
            else if let Err(why) = self.push_client.send(message.unwrap()).await {
                match why {
                    //Add expired endpoints to removal list
                    WebPushError::EndpointNotValid => {
                        let endpoint = sub.sub.endpoint.clone();
                        subs_to_remove.push(endpoint);
                        log::info!("Added expired endpoint for removal.");
                    }
                    WebPushError::EndpointNotFound => {
                        let endpoint = sub.sub.endpoint.clone();
                        subs_to_remove.push(endpoint);
                        log::info!("Added expired endpoint for removal.");
                    }
                    _ => log::error!("When sending webpush to client: {}", why),
                }
            }
        }

        // Remove bad endpoints
        for rm_sub in subs_to_remove {
            match subs.remove_registration(&rm_sub).await {
                Ok(_) => log::info!("Removed stale endpoint {}", rm_sub),
                Err(err) => log::error!("Error: {} when removing endpoints", err),
            }
        }
    }
}
