/*
 * Copyright (c) 2021. Andrew Ealovega
 */

use serde::{Deserialize, Serialize};

/// EC base64 encoded private key.
#[derive(Clone)]
pub struct PrivateKey(pub String);

/// EC base64 encoded public key.
#[derive(Clone)]
pub struct PublicKey(pub String);

pub type Keys = (PrivateKey, PublicKey);

/// Current operating status of a ride. Defaults to `Closed`.
#[derive(Copy, Clone, Debug, Serialize, Deserialize, Ord, PartialOrd, Eq, PartialEq, Hash, Default)]
pub enum RideStatus {
    /// Ride is open, and has a specified wait. Time is always in minutes.
    #[serde(rename = "wait")]
    Wait(u16),
    /// Ride is open with unspecified wait. This often means a ride just opened.
    Open,
    /// Ride is closed.
    #[default]
    Closed
}

/// Clients alert config.
#[derive(Clone, Debug, Serialize, Deserialize, Ord, PartialOrd, Eq, PartialEq, Default, Hash)]
#[serde(rename_all = "camelCase")]
pub struct RideConfig {
    pub ride_name: String,
    pub alert_on: RideStatus,
}
