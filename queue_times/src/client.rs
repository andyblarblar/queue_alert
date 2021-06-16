/*
 * Copyright (c) 2021. Andrew Ealovega
 */

//! Contains implementations of [`reqwest`] based clients for parsing queue times.
//!
//! Almost all use cases will want to use [`CachedClient`] like so:
//! ```
//! use queue_times::client::{Client, QueueTimesClient, CachedClient};
//!
//! let client = CachedClient::default(); //Replace with `Client::new()` to remove caching if needed
//! let parks = client.get_park_urls().await?;
//! let cedar_point_waits = client.get_ride_times(parks.get("Cedar Point")?.to_owned()).await?;
//!
//! let mille_wait = cedar_point_waits.iter().find(|r| r.name == "Millennium Force").unwrap();
//!
//! println!("The current wait for Millennium Force is: {:?}", mille_wait.status)
//! ```
//!
//! All clients use Tokio async, and are thread-safe.
//!
//! Traits in this module use [`async_trait`] to achive the obvious. Because of this however, function
//! signatures can become quite mangeled. It may be worth looking at the source code for [`QueueTimesClient`]
//! if the signatures don't seem obvious.

use std::collections::HashMap;

use async_trait::async_trait;
use chrono::{Duration, Local};
use reqwest::Client as reqClient;
use tokio::sync::RwLock;
use url::Url;

use crate::error::*;
use crate::model::RideTime;
use crate::parser::{FrontPageParser, GenericParkParser, ParkParser};

/// Base Url to the queue times website.
pub static BASE_URL: &str = "https://queue-times.com";

/// Defines the public interface of a queue times client.
#[async_trait]
pub trait QueueTimesClient {
    /// Retrieves a map of park names to the url of their rides page.
    ///
    /// Urls are absolute to the resource.
    ///
    /// Names are properly capitalised, eg. 'Cedar Point' or 'Parc Astérix'.
    ///
    /// # Errors
    /// This function will error if the website HTML is too malformed to parse, or if the queue times
    /// website is offline.
    async fn get_park_urls(&self) -> Result<HashMap<String, Url>>;

    /// Retrieves the queue times for all parsable rides on a park rides page.
    ///
    /// # Arguments
    /// * park_url - An *Absolute* URL to park ride page to parse. Get these from [`Self::get_park_urls`].
    ///
    /// # Errors
    /// This function will error if the website HTML is too malformed to parse, or if the queue times
    /// website is offline.
    async fn get_ride_times(&self, park_url: Url) -> Result<Vec<RideTime>>;
}

/// Provides a queue times client that uses the generic parser without caching.
///
/// ```
/// use queue_times::client::{Client, QueueTimesClient};
///
/// let mut client = Client::new();
/// let parks = client.get_park_urls().await?;
/// let cedar_point_waits = client.get_ride_times(parks.get("Cedar Point")?.to_owned()).await?;
///
/// let mille_wait = cedar_point_waits.iter().find(|r| r.name == "Millennium Force").unwrap();
///
/// println!("The current wait for Millennium Force is: {:?}", mille_wait.status)
/// ```
pub struct Client {
    park_parser: GenericParkParser,
    front_parser: FrontPageParser,
    reqwest_client: reqClient,
}

impl Client {
    pub fn new() -> Self {
        Client {
            park_parser: GenericParkParser::new(),
            front_parser: FrontPageParser::new(),
            reqwest_client: reqClient::new(),
        }
    }
}

impl Default for Client {
    fn default() -> Self {
        Client {
            park_parser: GenericParkParser::new(),
            front_parser: FrontPageParser::new(),
            reqwest_client: reqClient::new(),
        }
    }
}

#[async_trait]
impl QueueTimesClient for Client {
    async fn get_park_urls(&self) -> Result<HashMap<String, Url>> {
        let response = self
            .reqwest_client
            .get(Url::parse(BASE_URL).unwrap().join("/en-US/parks").unwrap())
            .send()
            .await?;
        let html = response.text().await?;

        self.front_parser.get_park_urls(&html)
    }

    async fn get_ride_times(&self, park_url: Url) -> Result<Vec<RideTime>> {
        let response = self.reqwest_client.get(park_url).send().await?;
        let html = response.text().await?;

        self.park_parser.get_ride_times(&html)
    }
}

/// Thread-safe cache wrapper for a [`QueueTimesClient`].
///
/// # Details
/// The cached client will only hit the API every five minutes, as that is the rate that the queue times
/// website updates wait times. This means that this client is far more efficient if large numbers of requests
/// are made to the API, such as when being used in a server. The internal state and thread-safe nature do however
/// add considerable overhead in scenarios where only occasional calls are made, so a choice must be made depending
/// on your use case.
///
/// # Example
/// ```
/// use queue_times::client::{Client, QueueTimesClient, CachedClient};
///
/// let client = Client::new();
/// let client = CachedClient::new(client); //The only added line!
/// let parks = client.get_park_urls().await?;
/// let cedar_point_waits = client.get_ride_times(parks.get("Cedar Point")?.to_owned()).await?;
///
/// let mille_wait = cedar_point_waits.iter().find(|r| r.name == "Millennium Force").unwrap();
///
/// println!("The current wait for Millennium Force is: {:?}", mille_wait.status)
/// ```
pub struct CachedClient<T>
where
    T: QueueTimesClient + Send + Sync,
{
    client: T,
    /// Cache of park URL to ride times. This should contain all parks at all times.
    cache: dashmap::DashMap<Url, Vec<RideTime>>,
    /// Cache of park name to URL to rides page. Never needs to be updated.
    parks_cache: RwLock<HashMap<String, Url>>, //use RwLock over dashmap to avoid clone when returning
    /// Last update to cache, update every 5 minutes.
    last_updated: RwLock<chrono::DateTime<Local>>,
}

impl<T> CachedClient<T>
where
    T: QueueTimesClient + Send + Sync,
{
    /// Wraps the passed client with a cache.
    pub fn new(client: T) -> Self {
        CachedClient {
            client,
            cache: dashmap::DashMap::new(),
            parks_cache: RwLock::new(HashMap::new()),
            last_updated: RwLock::new(Local::now() - Duration::minutes(6)),
        }
    }
}

#[async_trait]
impl<T> QueueTimesClient for CachedClient<T>
where
    T: QueueTimesClient + Send + Sync,
{
    async fn get_park_urls(&self) -> Result<HashMap<String, Url>> {
        //Fill cache if never been used
        if self.parks_cache.read().await.is_empty() {
            let parks = self.client.get_park_urls().await?;

            //Update cache
            let mut lock = self.parks_cache.write().await;
            *lock = parks.clone();

            Ok(parks)
        } else {
            let lock = self.parks_cache.read().await;

            Ok(lock.clone())
        }
    }

    async fn get_ride_times(&self, park_url: Url) -> Result<Vec<RideTime>> {
        {
            let time_lock = self.last_updated.read().await;

            //Return cache if website hasn't updated yet
            if (Local::now() - *time_lock) < chrono::Duration::minutes(5) {
                let rides = self
                    .cache
                    .get(&park_url)
                    .ok_or_else(|| Error::from(ErrorKind::BadUrl(park_url)))?;

                return Ok(rides.value().clone());
            }
        }

        //Update cache
        let mut parks = self.get_park_urls().await?;

        //Get each park
        for (_, park_url) in parks.drain() {
            let times = self.client.get_ride_times(park_url.clone()).await?;

            self.cache.insert(park_url, times);
        }

        let mut time_lock = self.last_updated.write().await;
        *time_lock = Local::now();

        //Use new cache to respond
        Ok(self
            .cache
            .get(&park_url)
            .ok_or_else(|| Error::from(ErrorKind::BadUrl(park_url)))?
            .clone())
    }
}

impl Default for CachedClient<Client> {
    fn default() -> Self {
        CachedClient::new(Client::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client() {
        let client = Client::new();
        let parks = client.get_park_urls().await.unwrap();
        println!("CP URL {}", parks.get("Cedar Point").unwrap().to_string());
        let cedar_point_waits = client
            .get_ride_times(parks.get("Cedar Point").unwrap().to_owned())
            .await
            .unwrap();

        let mille_wait = cedar_point_waits
            .iter()
            .find(|r| r.name == "Millennium Force")
            .unwrap();
        println!(
            "The current wait for Millennium Force is: {:?}",
            mille_wait.status
        )
    }

    #[tokio::test]
    async fn test_cache_client() {
        //Should just be able to wrap with no differences to semantics
        let client = Client::new();
        let client = CachedClient::new(client);
        let parks = client.get_park_urls().await.unwrap();
        println!("CP URL {}", parks.get("Cedar Point").unwrap().to_string());

        //Repeat to test cache consistency
        let cedar_point_waits = client
            .get_ride_times(parks.get("Cedar Point").unwrap().to_owned())
            .await
            .unwrap();

        let og_mille_wait = cedar_point_waits
            .iter()
            .find(|r| r.name == "Millennium Force")
            .unwrap();
        println!(
            "The current wait for Millennium Force is: {:?}",
            og_mille_wait.status
        );

        let cedar_point_waits = client
            .get_ride_times(parks.get("Cedar Point").unwrap().to_owned())
            .await
            .unwrap();

        let mille_wait = cedar_point_waits
            .iter()
            .find(|r| r.name == "Millennium Force")
            .unwrap();
        assert_eq!(mille_wait, og_mille_wait);

        let cedar_point_waits = client
            .get_ride_times(parks.get("Cedar Point").unwrap().to_owned())
            .await
            .unwrap();

        let mille_wait = cedar_point_waits
            .iter()
            .find(|r| r.name == "Millennium Force")
            .unwrap();
        assert_eq!(mille_wait, og_mille_wait);
    }
}
