/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/// PEM ec private key.
#[derive(Clone)]
pub struct PrivateKey(pub String);

/// URL-Base64 encoded DER public ec key.
#[derive(Clone)]
pub struct PublicKey(pub String);

pub type Keys = (PrivateKey, PublicKey);