use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error(transparent)]
    DBError(#[from] sqlx::Error),
    #[error(transparent)]
    SerializationErr(#[from] serde_json::Error)
}