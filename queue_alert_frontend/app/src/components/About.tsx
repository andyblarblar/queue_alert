/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @file About page.
 */

import {useEffect, useState} from "react";
import Faq from "./Faq";
import {useQaClient} from "./qaUrlStore";

function About() {
    const [userCount, setUserCount] = useState(0)
    const {client} = useQaClient()

    useEffect(() => {
        client.getUserCount().then(users => {
            if (users.ok) {
                setUserCount(users.val)
            }
        })
    }, [])

    return (
        <div id="FAQ-container">
            <div id="about-welcome">
                <Faq title={`Welcome to Queue Alert, currently serving ${userCount} users!`}>
                    Queue Alert is a Progressive Web App (PWA) that will send notifications whenever an amusement ride
                    reaches
                    a certain wait-time threshold. This app was inspired by a particularly windy trip to Cedar Point,
                    where I spent all day checking <a href="https://queue-times.com">Queue times</a> on my phone
                    while waiting for SteVe to open. Queue Alert aims to be a mobile first, streamlined, and ergonomic
                    solution to automate checking wait times such that you can spend less time checking your phone, and
                    more time
                    enjoying your visit.
                </Faq>
            </div>

            <div id="FAQ">FAQ</div>

            <Faq title="I'm on iOS and can't save!">
                Unfortunately, Apple does not support web push notifications on iOS or Safari yet.
                This means that Queue Alert is unable to operate. Because Apple is so protective of its app store,
                I don't see this going away any time soon. Should this block ever be dropped however, Queue Alert
                will work immediately.
            </Faq>

            <Faq title="I keep getting 'Website updated in the background' notifications!">
                This is due to privacy features in the web push API. Whenever the app receives an update from the
                server,
                a notification must be shown. If there are no ride alerts to notify you with, this notification is used
                as
                a placeholder.
            </Faq>

            <Faq title="I keep getting 'Cannot connect to server' errors!">
                This is likely due to the Queue Alert backend, which is currently self hosted, being down.
                If this app gets popular, I may move this to a cloud implementation to improve uptime and speed.
            </Faq>

            <Faq title="How do I stop getting notifications?">
                To stop getting notifications, simply delete all set alerts by clicking the trashcan icon in the
                current alerts table.
            </Faq>

            <Faq title="Where do you get the ride times from?">
                I currently use the excellent <a href="https://queue-times.com">Queue times</a> website to get
                the data for alerts. I highly recommend checking it out if you want more detailed data, such as
                park crowds, forecasts, and ride stats.
            </Faq>

            <Faq title="Is there any way to submit an issue?">
                Sure, if you're technical enough. Queue Alerts is FOSS, hosted on <a
                href="https://github.com/andyblarblar/queue_alert">github</a>. If
                you want, you can leave an issue on the repo and I'll see if I can work on it. Please don't submit
                anything on this FAQ,
                and provide your browser version for any issues. Thanks!
            </Faq>

            <Faq title="Can I configure multiple parks at once?">
                Unfortunately, Queue Alert was not designed for multiple parks at once. This was initially due to size
                constraints, but may be added in the future if I get the time.
            </Faq>

        </div>
    )
}

export default About
