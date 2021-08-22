/*
 * Copyright (c) 2021. Andrew Ealovega
 */

use error_chain::error_chain;

#[cfg(not(feature = "client"))]
error_chain! {

    foreign_links {
        Url( url::ParseError);
    }

    errors {
        /// Wait time text failed to parse.
        WaitTimeParse(t: String){
            description("Wait time was not in form '# mins'"),
            display("Failed to parse wait time, expected '# mins', got: {}", t),
        }

        /// Href is missing when needed.
        HrefMissing {
            description("An href link was missing when needed."),
            display("Failed to parse due to a missing href tag."),
        }
    }
}

//feature gate so we dont import tokio just for errors
#[cfg(feature = "client")]
error_chain! {

    foreign_links {
        Url( url::ParseError);
        Reqwest( reqwest::Error);
    }

    errors {
        /// Wait time text failed to parse.
        WaitTimeParse(t: String){
            description("Wait time was not in form '# mins'"),
            display("Failed to parse wait time, expected '# mins', got: {}", t),
        }

        /// Href is missing when needed.
        HrefMissing {
            description("An href link was missing when needed."),
            display("Failed to parse due to a missing href tag."),
        }
        
        /// A bad Url was passed to a method.
        BadUrl(t: url::Url) {
            description("A bad Url was passed to a method."),
            display("A bad Url was passed: {}", t),
        }
    }
}