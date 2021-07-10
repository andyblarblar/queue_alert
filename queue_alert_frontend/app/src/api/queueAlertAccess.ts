/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/**
 * @file contains methods for accessing the queue alert api.
 */


import { Err, Ok, Result } from "ts-results";

/**
 * Map of park name to its ride page url.
 */
export type parkMap = Map<string, string>

/**
 * A ride status record. Wait time is always in minutes.
*/
export type rideTime = { name: string, status: "Open" | "Closed" | { Wait: number } }

export default class QueueAlertAccess {
    readonly url: string

    constructor(queueAlertUrl: string) {
        this.url = queueAlertUrl
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
        }
        else {
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
        req += new URLSearchParams({ "url": url.toString() }).toString()

        let res = await fetch(this.url + req.toString())

        if (res.ok) {
            let json = (await res.json()) as rideTime[]
            console.log(JSON.stringify(json))
            return Ok(json)
        }
        else {
            return Err(res.status)
        }
    }

    /**
     * Subscribes client to the browsers push service. Must have a registered service worker first.
     */
    async subscribeUserToPush(): Promise<Result<PushSubscription, Error>> {
        const worker = await navigator.serviceWorker.getRegistration('/');//TODO this prob doesnt work anymore 

        if (worker == null) return Err(new Error("No service worker registered!"))

        //Check if already subscribed
        let sub = await worker.pushManager.getSubscription()
        if (sub) {
            console.log('Client was already subscribed: ', JSON.stringify(sub));
            return Ok(sub)
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
            sub = await worker.pushManager.subscribe(subscribeOptions);
            console.log('Received new PushSubscription: ', JSON.stringify(sub));
        } catch (err) {
            return Err(err)
        }

        return Ok(sub);
    }

    async unsubscribeUserFromPush(sub: PushSubscription) {
        await sub.unsubscribe()

        console.debug("unsubbed from push")
    }

    /**
     * Registers this user with the queue alert backend, causing the server to send notifications.
     * @param subscription The subscription object associated with this user.
     * @param park The park this user will listen to.
     * @return Ok if 200, Err if any other http code, returns that other number.
     */
    async registerWithBackend(subscription: PushSubscription, park: string): Promise<Result<null, number>> {

        const body = JSON.stringify({ sub: subscription, park: park });

        const res = await fetch(this.url + '/register', {
            method: 'post',
            headers: {
                'Content-type': 'application/json'
            },
            body: body,
        });
        console.debug("registering with server");

        if (res.ok) {
            return Ok(null)
        }
        else {
            return Err(res.status)
        }
    }

    /**
     * Unregisters this user with the queue alert backend, causing the server to stop notifications.
     * @param subscription The subscription object associated with this user.
     * @param park The park this user will listen to.
     * @return Ok if 200, Err if any other http code, returns that other number.
     */
    async unregisterWithBackend(subscription: PushSubscription): Promise<Result<null, number>> {
        const res = await fetch(this.url + '/unregister', {
            method: 'post',
            headers: {
                'Content-type': 'application/json'
            },
            body: JSON.stringify(subscription),
        });
        console.debug("unregistered with server");

        if (res.ok) {
            return Ok(null)
        }
        else {
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