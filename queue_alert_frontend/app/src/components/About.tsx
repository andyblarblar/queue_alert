/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import Faq from "./Faq";

function About() {
    return (
        <div id="FAQ-container">
            <div id="about-welcome">
                <Faq title="Welcome to Queue Alert!">
                    Queue Alert is a Progressive Web App (PWA) that will send notifications whenever an amusement ride reaches
                    a certain wait-time threshold. This app was inspired by a particularly windy trip to Cedar Point,
                    where I spent all day checking <a href="https://queue-times.com">Queue times</a> on my phone
                    for SteVe to open.
                </Faq>
            </div>


            <div id="FAQ">FAQ</div>

            <Faq title="I'm on IOS and can't save!">
                Unfortunately, Apple does not support web push notifications on IOS or safari yet.
                This means that Queue Alert is unable to operate. Because Apple is so protective of its app store,
                I don't see this going away any time soon. Should this block ever be dropped however, Queue Alert
                will work immediately.
            </Faq>

            <Faq title="I keep getting 'Cannot connect to server' errors!">
                This is likely due to the Queue Alert backend, which is currently self hosted, being down.
                If this app gets popular, I may move this to a cloud implementation to improve uptime and speed.
            </Faq>

            <Faq title="How do I stop getting notifications?">
                To stop getting notifications, head to the park page you've subscribed to and flick all switches
                off. Now just save the config, and notifications will stop.
            </Faq>

            {/*<Faq title="Why do I keep getting 'no conditions met' notifications?"> TODO check if you can avoid this on all browsers, then remove this FAQ.
                Unfortunately, the web push API demands that I send a notification with each server update,
                even if nothing has changed. Hence, I send this notification instead.
               </Faq>*/}

            <Faq title="Where do you get the ride times from?">
                I currently use the excellent <a href="https://queue-times.com">Queue times</a> website to get
                the data for alerts. I highly recommend checking it out if you want more detailed data, such as
                park crowds, forecasts, and ride stats.
            </Faq>

            <Faq title="Is there any way to submit an issue?">
                Sure, if you're technical enough. Queue Alerts is FOSS, hosted on <a href="https://github.com/andyblarblar/queue_alert">github. </a>
                If you want, you can leave an issue on the repo and I'll see if I can work on it. Please dont submit anything on this FAQ,
                and provide your browser version for any issues. Thanks!
            </Faq>

            <Faq title="Can I configure multiple parks at once?">
                Unfortunately, Queue Alert was not designed for multiple parks at once. While this Could
                (and may) be added at a later time, I began to hit transfer size constraints when multiple parks
                where used. Should the push notification be compressed, this would be possible, yet the server
                refuses to send when this is applied {'>'}:[
            </Faq>

        </div>
    )
}

export default About
