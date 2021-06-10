/*
 * Copyright (c) 2021. Andrew Ealovega
 */

mod routes;

use actix_web::*;
use actix_files::{Files};
use simplelog::{Config, LevelFilter};
use actix_web::middleware::Logger;
use std::sync::Arc;


#[actix_web::main]
async fn main() -> std::io::Result<()> {
    simplelog::SimpleLogger::init(LevelFilter::Debug, Config::default()).unwrap();

    //All subscribed users, to be sorted by endpoint to allow for binary searches
    let subs = Arc::new(routes::RWVec::new(Vec::new()));

    HttpServer::new(move || {
        App::new()
            .wrap(Logger::new("%a %U %s"))
            .data(subs.clone())//Clients to push to
            //Begin endpoints
            .service(routes::vapid_public_key)
            .service(routes::register)
            .service(routes::unregister)
            .service(routes::ping)//TODO remove this
            .service(Files::new("/","./www").index_file("index.html"))//Must be last, serves static site
    })
        .bind(("127.0.0.1", 8080))?
        .run()
        .await
}
