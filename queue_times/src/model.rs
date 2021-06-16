/*
 * Copyright (c) 2021. Andrew Ealovega
 */
//! Contains models used in parsing

use serde::{Deserialize, Serialize};

/// Current operating status of a ride. Defaults to `Closed`.
#[derive(Copy, Clone, Debug, Serialize, Deserialize, Ord, PartialOrd, Eq, PartialEq, Hash)]
pub enum RideStatus {
    /// Ride is open with unspecified wait. This often means a ride just opened.
    Open,
    /// Ride is closed.
    Closed,
    /// Ride is open, and has a specified wait. Time is always in minutes.
    Wait(u16),
}

impl Default for RideStatus {
    fn default() -> Self {
        RideStatus::Closed
    }
}

/// Current status of a ride.
#[derive(Clone, Debug, Serialize, Deserialize, Ord, PartialOrd, Eq, PartialEq, Default, Hash)]
pub struct RideTime {
    pub name: String,
    pub status: RideStatus,
}
