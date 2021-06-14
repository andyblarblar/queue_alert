/*
 * Copyright (c) 2021. Andrew Ealovega
 */

use error_chain::error_chain;

error_chain!{

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