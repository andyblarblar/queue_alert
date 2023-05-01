/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @file contains methods for accessing the queue alert api.
 */

import {Err, Ok, Result} from "ts-results";
import {AlertConfig} from "./alertConfig";

/**
 * Map of park name to its ride page url.
 */
export type parkMap = Map<string, string>

/**
 * A ride status record. Wait time is always in minutes.
 */
export type rideTime = { name: string, status: "Open" | "Closed" | { Wait: number } }

/**
 * Provides access to the queue alert backend. Cannot be used in a serviceWorker.
 */
export default class QueueAlertAccess {
    readonly url: string

    private sub: PushSubscription | null = null

    private isRegistered = false

    /** Creates a new client for the queue alert at the passed base URL. */
    constructor(queueAlertUrl: string) {
        this.url = queueAlertUrl

        //Load current push sub if set.
        navigator.serviceWorker.getRegistration('/')
            .then((worker) => {
                if (worker == null) {
                    this.sub = null
                    return
                }

                worker.pushManager.getSubscription()
                    .then((sub) => {
                        console.debug(`got previous sub ${sub}`)
                        this.sub = sub
                    })
            })
    }

    /**
     * Attempts to get a map of all parks to their ride page url.
     *
     * @return parkMap if Ok, status code if Err.
     */
    async getAllParks(): Promise<Result<parkMap, number>> {
        let res = await fetch(this.url + '/allParks')

        if (res.ok) {
            let json = (await res.json()) as parkMap
            return Ok(json)
        } else {
            return Err(res.status)
        }
    }

    /**
     * Attempts to get the current number of connected users.
     *
     * @return number if Ok, status code if Err.
     */
    async getUserCount(): Promise<Result<number, number>> {
        let res = await fetch(this.url + '/userCount')

        if (res.ok) {
            let json = (await res.json()) as number
            return Ok(json)
        } else {
            return Err(res.status)
        }
    }

    /**
     * Attempts to get a list of ride times for a park url.
     *
     * @return ride times if Ok, else status code error.
     */
    async getParkRideTimes(url: URL): Promise<Result<rideTime[], number>> {

        let req = '/parkWaitTimes?'
        req += new URLSearchParams({"url": url.toString()}).toString()

        let res = await fetch(this.url + req.toString())

        if (res.ok) {
            let json = (await res.json()) as rideTime[]
            return Ok(json)
        } else {
            return Err(res.status)
        }
    }

    /**
     * Subscribes client to the browsers push service. Must have a registered service worker first. Does nothing if already registered.
     */
    async subscribeUserToPush(): Promise<Result<null, Error>> {
        //If already subbed, just ignore
        if (this.sub) {
            console.debug('Already subbed to push')
            return Ok(null)
        }

        //Get servers public key via API call
        const response = await fetch(this.url + '/vapidPublicKey');
        if (!response.ok) return Err(new Error(`vapidPublicKey returned ${response.status}`))

        const vapidPublicKey = await response.text();
        const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);//Convert from base64 for chrome compatibility

        const subscribeOptions = {
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        };

        try {
            const worker = await navigator.serviceWorker.getRegistration('/')
            const sub = await worker!.pushManager.subscribe(subscribeOptions);
            console.log('Received new PushSubscription: ', JSON.stringify(sub));
            this.sub = sub
        } catch (err) {
            return Err(err)
        }

        return Ok(null);
    }

    /**
     * Unsubs this user from push if registered.
     */
    async unsubscribeUserFromPush() {
        if (this.sub) {
            await this.sub.unsubscribe()
            console.debug("unsubbed from push")
            this.sub = null
        }
    }

    /**
     * Registers this user with the queue alert backend, causing the server to send notifications.
     * This can be used to update the config if already registered.
     * @param config Rides we wish to listen to. The server will push when one of these triggers.
     * @return Ok if 200, Err if any other http code, returns that other number.
     */
    async registerWithBackend(config: AlertConfig): Promise<Result<null, number>> {

        //Err if not subbed
        if (this.sub == null) {
            return Err(1)
        }

        const body = JSON.stringify({sub: this.sub, config: config});
        console.debug(`attempting to register with: ${JSON.stringify(body)}`)

        try {
            const res = await fetch(this.url + '/register', {
                method: 'post',
                headers: {
                    'Content-type': 'application/json'
                },
                body: body,
            });

            if (res.ok) {
                console.debug("registered with server");
                this.isRegistered = true
                return Ok(null)
            } else {
                return Err(res.status)
            }
        } catch (e) {
            return Err(400)
        }
    }

    /**
     * Unregisters this user with the queue alert backend, causing the server to stop notifications.
     * @param subscription The subscription object associated with this user.
     * @param park The park this user will listen to.
     * @return Ok if 200, Err if any other http code, returns that other number.
     */
    async unregisterWithBackend(): Promise<Result<null, number>> {

        if (this.sub == null) {
            //Double check we aren't subbed, to avoid crashing needlessly
            const worker = await navigator.serviceWorker.getRegistration('/')
            let sub = await worker?.pushManager.getSubscription()

            if (sub == null) {
                return Err(1)
            }

            this.sub = sub
        }

        const res = await fetch(this.url + '/unregister', {
            method: 'post',
            headers: {
                'Content-type': 'application/json'
            },
            body: JSON.stringify(this.sub),
        });

        if (res.ok) {

            console.debug("unregistered with server");
            this.isRegistered = false
            return Ok(null)
        } else {
            return Err(res.status)
        }
    }

    /**
     * Converts a base64 encoded url safe byte array into a Uint8Array.
     * @param base64String base64 encoded array.
     */
    urlBase64ToUint8Array(base64String: string) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
}