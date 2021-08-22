queue_times is a crate for scraping data from the [queue times website.](https://queue-times.com/en-US)

Most consumers of this crate will want to use [`client::CachedClient`] or another client from [`client`]. This is
enabled with the feature `client`.

 ```rust
 use queue_times::client::{Client, QueueTimesClient, CachedClient};

 let client = CachedClient::default(); //Replace with `Client::new()` to remove caching if needed
 let parks = client.get_park_urls().await?;
 let cedar_point_waits = client.get_ride_times(parks.get("Cedar Point")?.to_owned()).await?;

 let mille_wait = cedar_point_waits.iter().find(|r| r.name == "Millennium Force").unwrap();

 println!("The current wait for Millennium Force is: {:?}", mille_wait.status)
 ```

[`parser`] contains structs for parsing ride times from the raw html, and can be extended for parsing either newer
versions of queue times as the API breaks, or even other websites (or anything really).