/*
 * Copyright (c) 2021. Andrew Ealovega
 */

use serde::{Deserialize, Serialize};
use web_push::{PartialVapidSignatureBuilder, SubscriptionInfo};

/// EC base64 encoded private key.
#[derive(Clone)]
pub struct PrivateKey(pub String);

/// EC base64 encoded public key.
#[derive(Clone)]
pub struct PublicKey(pub String);

pub type Keys = (PrivateKey, PublicKey, PartialVapidSignatureBuilder);

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

/// A clients registration.
#[derive(serde::Deserialize, serde::Serialize)]
pub struct Registration {
    /// Push API endpoint info.
    pub sub: SubscriptionInfo,
    /// Users config. Tuple of (park, Rides to wait on).
    pub config: (String, Vec<RideConfig>),
}