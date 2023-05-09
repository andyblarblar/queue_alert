//! Implementation using the official queue times API

use crate::client::{QueueTimesClient, BASE_URL};
use crate::model::{RideStatus, RideTime};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use url::Url;

/// Client that uses the official Queue Times API instead of scraping.
pub struct ApiClient {
    reqwest_client: reqwest::Client,
}

impl ApiClient {
    pub fn new() -> Self {
        Self {
            reqwest_client: reqwest::Client::new(),
        }
    }
}

impl Default for ApiClient {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl QueueTimesClient for ApiClient {
    async fn get_park_urls(&self) -> crate::error::Result<HashMap<String, Url>> {
        let mut park_map = HashMap::new();

        let parks_json = self
            .reqwest_client
            .get("https://queue-times.com/en-US/parks.json")
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let brands_json = parks_json.as_array().unwrap();

        // Parks are nested in brands
        for brands in brands_json {
            let parks = brands.get("parks").unwrap().as_array().unwrap();

            for park in parks {
                let id = park.get("id").unwrap().as_i64().unwrap();
                let name = park.get("name").unwrap().as_str().unwrap();

                park_map.insert(
                    name.to_string(),
                    Url::parse(BASE_URL)
                        .unwrap()
                        .join("en-US/parks/")
                        .unwrap()
                        .join(&format!("{}/", id))
                        .unwrap()
                        .join("queue_times")
                        .unwrap(),
                );
            }
        }

        Ok(park_map)
    }

    async fn get_ride_times(&self, park_url: Url) -> crate::error::Result<Vec<RideTime>> {
        // Scraper uses the html page, we want the raw json
        let park_url = park_url.to_string() + ".json";

        let rides_json = self
            .reqwest_client
            .get(park_url)
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;

        let lands_json = rides_json.get("lands").unwrap().as_array().unwrap();
        let rides_json = rides_json.get("rides").unwrap().as_array().unwrap();

        fn parse_rides(rides: &[Value]) -> Vec<RideTime> {
            rides
                .iter()
                .map(|r| {
                    let name = r.get("name").unwrap().as_str().unwrap();
                    let is_open = r.get("is_open").unwrap().as_bool().unwrap();
                    let wait = r.get("wait_time").unwrap().as_i64().unwrap();

                    RideTime {
                        name: name.to_string(),
                        status: if is_open && wait == 0 {
                            RideStatus::Open
                        } else if is_open {
                            RideStatus::Wait(wait as u16)
                        } else {
                            RideStatus::Closed
                        },
                    }
                })
                .collect()
        }

        // Some parks have lands, some don't. Only one array is filled at a time
        if lands_json.is_empty() {
            Ok(parse_rides(rides_json))
        } else {
            Ok(parse_rides(
                &lands_json
                    .iter()
                    .flat_map(|l| l.get("rides").unwrap().as_array().unwrap())
                    .cloned()
                    .collect::<Vec<Value>>(),
            ))
        }
    }
}

#[cfg(test)]
mod test {
    use crate::api::ApiClient;
    use crate::client::{Client, QueueTimesClient};

    #[tokio::test]
    async fn test_parks() {
        let cli = ApiClient::new();
        let parks = cli.get_park_urls().await.unwrap();

        assert_eq!(
            parks["Cedar Point"].as_str(),
            "https://queue-times.com/en-US/parks/50/queue_times"
        );
    }

    #[tokio::test]
    async fn test_rides() {
        let cli = ApiClient::new();
        let parks = cli.get_park_urls().await.unwrap();

        let rides = cli
            .get_ride_times(parks["Cedar Point"].clone())
            .await
            .unwrap();

        assert!(!rides.is_empty());
    }

    #[tokio::test]
    async fn test_equivalent() {
        let cli = ApiClient::new();
        let cli2 = Client::new();

        let parks1 = cli.get_park_urls().await.unwrap();
        let parks2 = cli2.get_park_urls().await.unwrap();

        assert_eq!(parks1["Cedar Point"], parks2["Cedar Point"]);

        let rides1 = cli
            .get_ride_times(parks1["Cedar Point"].clone())
            .await
            .unwrap();

        let rides2 = cli2
            .get_ride_times(parks2["Cedar Point"].clone())
            .await
            .unwrap();

        assert_eq!(rides1, rides2);
    }
}
