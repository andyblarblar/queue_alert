/*
 * Copyright (c) 2021. Andrew Ealovega
 */

//! Contains implementations of [`reqwest`] based clients for parsing queue times.
//!
//! Almost all use cases will want to use [`CachedClient`] like so:
//! ```no-run
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
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

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
/// ```no-run
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
/// The implimentation will eagerly return results, but lazaly updates cache. This means that if the client is never called,
/// then it will never update the cache. But if it does need to update the cache, it will first return the result of the request,
/// while the cache updates in the background.
///
/// # Example
/// ```no-run
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
        T: QueueTimesClient + Send + Sync + 'static,
{
    /// The client, Arc wrapped to allow for use in tokio tasks.
    client: Arc<T>,
    /// Cache of park URL to ride times. This should contain all parks at all times.
    ride_cache: Arc<dashmap::DashMap<Url, Vec<RideTime>>>,
    /// Cache of park name to URL to rides page. Never needs to be updated.
    parks_cache: RwLock<HashMap<String, Url>>,
    //use RwLock over dashmap to avoid clone when returning
    /// Last update to cache, update every 5 minutes.
    last_updated: Arc<RwLock<chrono::DateTime<Local>>>,
    /// True if cache is currently updating in background.
    currently_updating_cache: Arc<AtomicBool>,
}

impl<T> CachedClient<T>
    where
        T: QueueTimesClient + Send + Sync + 'static,
{
    /// Wraps the passed client with a cache.
    pub fn new(client: T) -> Self {
        CachedClient {
            client: Arc::new(client),
            ride_cache: Arc::new(dashmap::DashMap::new()),
            parks_cache: RwLock::new(HashMap::new()),
            last_updated: Arc::new(RwLock::new(Local::now() - Duration::minutes(6))),
            currently_updating_cache: Arc::new(Default::default()),
        }
    }
}

#[async_trait]
impl<T> QueueTimesClient for CachedClient<T>
    where
        T: QueueTimesClient + Send + Sync + 'static,
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
                    .ride_cache
                    .get(&park_url)
                    .ok_or_else(|| Error::from(ErrorKind::BadUrl(park_url)))?;

                return Ok(rides.value().clone());
            }
        }

        //Cache must be updated

        //Clone Arcs
        let mut parks = self.get_park_urls().await?;
        let client = self.client.clone();
        let ride_cache = self.ride_cache.clone();
        let last_updated = self.last_updated.clone();
        let currently_updating = self.currently_updating_cache.clone();

        //Check if we're already updating to avoid downloading more than once
        if !currently_updating.load(Ordering::SeqCst) {
            log::debug!("Updating cache");

            currently_updating.store(true, Ordering::SeqCst);

            //Update cache in background, and eagerly return the requested park
            tokio::spawn(async move {
                let _guard = CompletionGuard { complete: currently_updating };

                //Get each park
                for (_, park_url) in parks.drain() {
                    let times = client.get_ride_times(park_url.clone()).await.unwrap();//TODO handle. For now it may be fine to let it just die, as last_updated will call another cache update

                    ride_cache.insert(park_url, times);
                }
                let mut time_lock = last_updated.write().await;
                *time_lock = Local::now();
            });
        }

        let times = self.client.get_ride_times(park_url).await?;
        Ok(times)
    }
}

impl Default for CachedClient<Client> {
    fn default() -> Self {
        CachedClient::new(Client::new())
    }
}

/// RAII type that signals the completion or cancellation of a task.
/// Will be `false` on drop, useful for ensuring cancelled async tasks are handled.
struct CompletionGuard {
    complete: Arc<AtomicBool>,
}

impl Drop for CompletionGuard {
    fn drop(&mut self) {
        self.complete.store(false, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client() {
        let client = Client::new();
        let parks = client.get_park_urls().await.unwrap();
        println!("CP URL {}", parks.get("Cedar Point").unwrap());
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
        println!("CP URL {}", parks.get("Cedar Point").unwrap());

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
