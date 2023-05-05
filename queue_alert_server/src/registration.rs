//! User registration management

use crate::error::Error;
use crate::models::{Registration, RideConfig, RideStatus};
use dashmap::DashMap;
use sqlx::sqlite::{SqliteConnectOptions, SqliteRow};
use sqlx::{query, Executor, Row, Sqlite, SqlitePool, Transaction};
use std::path::PathBuf;
use web_push::SubscriptionInfo;

/// Handles user registration, persisting to disk.
///
/// This struct implements a lockless write back cache, so reads will not touch the disk. It is assumed
/// that no other application is writing to the db while we are running, so we assume we are always
/// consistent with the db.
pub struct RegistrationRepository {
    /// Cache of endpoint to registration data
    pub cache: DashMap<String, Registration>,
    db: SqlitePool,
}

impl<'a> RegistrationRepository {
    /// loads the database, caching the current results if it exists or creating a new db otherwise.
    pub async fn init() -> Result<Self, Error> {
        let db = SqlitePool::connect_with(
            SqliteConnectOptions::new()
                .create_if_missing(true)
                .filename(PathBuf::from("registrations.sqlite")),
        )
        .await?;

        // Run our 'migrations script'
        query(include_str!("../sql/init.sql")).execute(&db).await?;

        let cache = Self::cache_db(&db).await?;

        Ok(Self { cache, db })
    }

    /// Loads db into memory
    async fn cache_db(db: &SqlitePool) -> Result<DashMap<String, Registration>, Error> {
        let all_sub: Vec<SubscriptionInfo> = query("SELECT * FROM REGISTRATIONS")
            .map(|r: SqliteRow| serde_json::from_str(r.get("subscription_info")).unwrap())
            .fetch_all(db)
            .await?;

        log::info!("Loading {} registrations from the db", all_sub.len());

        let cache = DashMap::new();

        // Un-normalize all subs
        for sub in all_sub {
            let park: String = query("SELECT park FROM CONFIGS WHERE endpoint = ?")
                .bind(sub.endpoint.clone())
                .map(|r: SqliteRow| r.get("park"))
                .fetch_one(db)
                .await?;

            let config = query("SELECT ridename, alerton, wait FROM RIDEALERTS WHERE endpoint = ?")
                .bind(sub.endpoint.clone())
                .map(|r: SqliteRow| {
                    let name: String = r.get("ridename");
                    let alerton: &str = r.get("alerton");

                    let alerton = match alerton {
                        "open" => RideStatus::Open,
                        "closed" => RideStatus::Closed,
                        "wait" => {
                            let wait: u16 = r.get("wait");
                            RideStatus::Wait(wait)
                        }
                        // Db enforces this
                        _ => unreachable!(),
                    };

                    RideConfig {
                        alert_on: alerton,
                        ride_name: name,
                    }
                })
                .fetch_all(db)
                .await?;

            let reg = Registration {
                sub,
                config: (park, config),
            };
            cache.insert(reg.sub.endpoint.clone(), reg);
        }

        Ok(cache)
    }

    /// Gets the current number of connected users.
    pub fn get_current_user_count(&self) -> usize {
        self.cache.len()
    }

    /// Checks if a given endpoint is already registered.
    pub fn endpoint_is_registered(&self, endpoint: &str) -> bool {
        self.cache.contains_key(endpoint)
    }

    /// Add a new user registration. Reg must not already be in db.
    pub async fn add_registration(&self, reg: Registration) -> Result<(), Error> {
        //First add user to db
        let mut trans = self.db.begin().await?;

        // Add subscription info
        trans
            .execute(
                query("INSERT INTO REGISTRATIONS VALUES (?, ?, date())")
                    .bind(reg.sub.endpoint.clone())
                    .bind(serde_json::to_string(&reg.sub)?),
            )
            .await?;

        // Add park info
        trans
            .execute(
                query("INSERT INTO CONFIGS VALUES (?, ?)")
                    .bind(reg.sub.endpoint.clone())
                    .bind(reg.config.0.clone()),
            )
            .await?;

        // Add config
        Self::add_config_to_transaction(&reg, &mut trans).await?;

        trans.commit().await?;

        //Update cache
        self.cache.insert(reg.sub.endpoint.clone(), reg);

        Ok(())
    }

    /// Update an existing registration. User must already be in DB.
    pub async fn update_registration(&self, reg: Registration) -> Result<(), Error> {
        //First update db
        let mut trans = self.db.begin().await?;

        // Add park info
        trans
            .execute(
                query("UPDATE CONFIGS SET park = ? WHERE endpoint = ?")
                    .bind(reg.config.0.clone())
                    .bind(reg.sub.endpoint.clone()),
            )
            .await?;

        // Just remove the old config, then insert the new one
        trans
            .execute(
                query("DELETE FROM RIDEALERTS WHERE endpoint = ?").bind(reg.sub.endpoint.clone()),
            )
            .await?;

        // Add config
        Self::add_config_to_transaction(&reg, &mut trans).await?;

        trans.commit().await?;

        //Update cache
        self.cache.insert(reg.sub.endpoint.clone(), reg);

        Ok(())
    }

    /// Adds a new registration or updates an existing one.
    pub async fn add_or_update_registration(&self, reg: Registration) -> Result<(), Error> {
        if self.endpoint_is_registered(&reg.sub.endpoint) {
            log::info!("Updating existing registration {}", reg.sub.endpoint);
            self.update_registration(reg).await
        } else {
            log::info!("Adding new registration {}", reg.sub.endpoint);
            self.add_registration(reg).await
        }
    }

    /// Removes registration, if it exists. Returns bool indicating if registration existed.
    pub async fn remove_registration(&self, endpoint: &str) -> Result<bool, Error> {
        if self.endpoint_is_registered(endpoint) {
            log::info!("Unregistering {}", endpoint);
            query("DELETE FROM REGISTRATIONS WHERE endpoint = ?")
                .bind(endpoint.clone())
                .execute(&self.db)
                .await?;

            self.cache.remove(endpoint);

            Ok(true)
        } else {
            log::info!("Attempted to unregister non-existent registration");
            Ok(false)
        }
    }

    /// Adds all the rides in a users config into the RIDEALERTS table in a transaction.
    async fn add_config_to_transaction(
        reg: &Registration,
        trans: &mut Transaction<'a, Sqlite>,
    ) -> Result<(), Error> {
        for ride in reg.config.1.iter() {
            trans
                .execute(
                    query("INSERT INTO RIDEALERTS VALUES (?, ?, ?, ?)")
                        .bind(reg.sub.endpoint.clone())
                        .bind(ride.ride_name.clone())
                        .bind(match ride.alert_on {
                            RideStatus::Wait(_) => "wait",
                            RideStatus::Open => "open",
                            RideStatus::Closed => "closed",
                        })
                        .bind(if let RideStatus::Wait(time) = ride.alert_on {
                            Some(time)
                        } else {
                            None
                        }),
                )
                .await?;
        }
        Ok(())
    }
}
