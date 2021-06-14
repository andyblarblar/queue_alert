/*
 * Copyright (c) 2021. Andrew Ealovega
 */
//! Defines parsers for processing queue times pages

use error_chain::bail;
use scraper::html::Html;
use scraper::selector::Selector;
use std::collections::HashMap;
use url::Url;

use crate::error::*;
use crate::model::*;

//TODO make a parser for the main page of queue time to get parks and their url
/// Defines how a park's rides should be parsed out of an HTML page.
pub trait ParkParser {
    /// Creates a new parser on the passed HTML string.
    fn from_html(html: String) -> Self;

    /// Parses all rides and their current wait. Errors if HTML is unable to be properly parsed, but
    /// does not verify if valid.
    fn get_ride_times(&self) -> Result<Vec<RideTime>>;
}

/// Parser that can currently parse all parks.
///
/// # Example
/// ```
/// use queue_times::parser::{GenericParkParser, ParkParser};
/// //Gets Cedar Point's ride page
/// let html_str = reqwest::blocking::get("https://queue-times.com/en-US/parks/50/queue_times")?.text()?;
///
/// let parser = GenericParkParser::from_html(html_str);
///
/// let rides = parser.get_ride_times()?;
///
/// println!("{:?}", rides)
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct GenericParkParser {
    /// Selects rides for any park page.
    selector: Selector,
    html: Html,
}

impl ParkParser for GenericParkParser {
    fn from_html(html: String) -> Self {
        let selector = Selector::parse("nav.panel > a > span:not(.has-text-grey)").unwrap();

        GenericParkParser {
            selector,
            html: Html::parse_document(&html),
        }
    }

    fn get_ride_times(&self) -> Result<Vec<RideTime>> {
        let mut ride_times = Vec::new();
        let all_rides = self.html.select(&self.selector);
        let mut name_being_processed = true;
        let mut temp_ride_time = RideTime::default();
        let mut all_rides = all_rides.peekable();

        //Process all ride spans
        while let Some(span) = all_rides.next() {
            //Skip tag if the name being processed is followed by a name and not a time.
            if name_being_processed {
                let next = all_rides.peek();

                //Skip this tag if a time does not follow. If next is none, then the ride time wont be added anyway, so we dont handle it.
                if let Some(next) = next {
                    let next_str = next.text().collect::<String>();
                    let should_break = match next_str.as_str().trim() {
                        "Closed" => false,
                        "Open" => false,
                        time if time.ends_with("mins") => false,
                        _ => true,
                    };

                    //All state should be valid for the next name.
                    if should_break {
                        continue;
                    }
                }
            }

            //Extract name
            if name_being_processed {
                //Extract only the first text node, the second is the anon user report
                temp_ride_time.name = span.text().next().unwrap().trim().to_owned();

                name_being_processed = false;
            } else {
                //Extract status
                let status_str: String = span.text().collect();

                let status = match status_str.trim() {
                    "Closed" => RideStatus::Closed,
                    "Open" => RideStatus::Open,

                    //Attempt to extract time
                    time if time.ends_with("mins") => {
                        let split_str_min = time.split_ascii_whitespace().next();
                        if split_str_min.is_none() {
                            bail!(ErrorKind::WaitTimeParse(time.to_string()))
                        }

                        let time_int_res = split_str_min.unwrap().parse::<u16>();

                        match time_int_res {
                            Ok(time) => RideStatus::Wait(time),
                            Err(_) => {
                                bail!(ErrorKind::WaitTimeParse(time.to_string()))
                            }
                        }
                    }

                    _ => {
                        bail!(ErrorKind::WaitTimeParse("".to_string()))
                    }
                };

                temp_ride_time.status = status;
                ride_times.push(std::mem::take(&mut temp_ride_time));
                name_being_processed = true
            }
        }

        Ok(ride_times)
    }
}

/// Parser for the queue times front page. Used to parse what the current links to parks are.
///
/// # Example
///
/// ```
/// use queue_times::parser::FrontPageParser;
/// let html = reqwest::blocking::get("https://queue-times.com/en-US/parks/")?.text()?;
///
///  let parser = FrontPageParser::from_html(html);
///
///  let parks = parser.get_park_urls()?;
///
///  println!("{:?}", parks)
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct FrontPageParser {
    /// Selects a park.
    selector: Selector,
    html: Html,
}

impl FrontPageParser {
    /// Base Url to the queue times website
    const BASE_URL: &'static str = "https://queue-times.com";

    /// Creates a new parser from a front pages HTML.
    pub fn from_html(html: String) -> Self {
        let selector = Selector::parse(".panel-block").unwrap();

        FrontPageParser {
            selector,
            html: Html::parse_document(&html),
        }
    }

    /// Returns a map of {park name, Url to park}. Will fail if URLs fail to parse, or URLs are missing
    /// from the a tag.
    pub fn get_park_urls(&self) -> Result<HashMap<String, Url>> {
        let mut park_to_url = HashMap::new();
        let parks = self.html.select(&self.selector);
        let mut temp_park = (String::default(), Url::parse(Self::BASE_URL).unwrap());

        for park in parks {
            let link = park.value().attr("href");

            match link {
                None => {
                    bail!(ErrorKind::HrefMissing)
                }
                Some(link) => {
                    temp_park.1 = Url::parse(Self::BASE_URL)?.join(link)?;
                }
            }

            //Only take the park name
            let park_name: String = park.text().next().unwrap().to_string();

            temp_park.0 = park_name.trim().to_owned();

            park_to_url.insert(temp_park.0, temp_park.1);
        }

        Ok(park_to_url)
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn cedar_point_parses() {
        let html_str = reqwest::blocking::get("https://queue-times.com/en-US/parks/50/queue_times")
            .unwrap()
            .text()
            .unwrap();

        let parser = GenericParkParser::from_html(html_str);

        let rides = parser.get_ride_times().unwrap();

        assert!(!rides.is_empty(), "No rides were parsed.");

        println!("{:?}", rides)
    }

    #[test]
    fn blackpool_parses() {
        //Cedar point is well maintained, and is stable
        let html = reqwest::blocking::get("https://queue-times.com/en-US/parks/273/queue_times")
            .unwrap()
            .text()
            .unwrap();

        let parser = GenericParkParser::from_html(html);

        let rides = parser.get_ride_times().unwrap();

        assert!(!rides.is_empty(), "No rides were parsed.");

        println!("{:?}", rides)
    }

    #[test]
    fn laronde_parses() {
        //La ronde has a very bad page, with lots of missing times. These should be safely skipped.
        let html = reqwest::blocking::get("https://queue-times.com/en-US/parks/48/queue_times")
            .unwrap()
            .text()
            .unwrap();

        let parser = GenericParkParser::from_html(html);

        let rides = parser.get_ride_times().unwrap();

        assert!(!rides.is_empty(), "No rides were parsed.");

        println!("{:?}", rides)
    }

    #[test]
    fn frontier_city_parses() {
        //Frontier city has shows, which are different to parse. They should be skipped just like empty tags.
        let html = reqwest::blocking::get("https://queue-times.com/en-US/parks/282/queue_times")
            .unwrap()
            .text()
            .unwrap();

        let parser = GenericParkParser::from_html(html);

        let rides = parser.get_ride_times().unwrap();

        assert!(!rides.is_empty(), "No rides were parsed.");

        println!("{:?}", rides)
    }

    #[test]
    fn front_page_parses() {
        let html = reqwest::blocking::get("https://queue-times.com/en-US/parks/")
            .unwrap()
            .text()
            .unwrap();

        assert!(!html.is_empty(), "Front page was not fetched!");

        let parser = FrontPageParser::from_html(html);

        let parks = parser.get_park_urls().unwrap();

        assert!(!parks.is_empty(), "No parks were parks.");

        println!("{:?}", parks)
    }
}
