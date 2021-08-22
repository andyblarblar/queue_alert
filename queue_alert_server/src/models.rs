/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/// EC base64 encoded private key.
#[derive(Clone)]
pub struct PrivateKey(pub String);

/// EC base64 encoded public key.
#[derive(Clone)]
pub struct PublicKey(pub String);

pub type Keys = (PrivateKey, PublicKey);
