/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

// This service worker can be customized!
// See https://developers.google.com/web/tools/workbox/modules
// for the list of available Workbox modules, or add any other
// code you'd like.
// You can also remove this file if you'd prefer not to use a
// service worker, and the Workbox build step will be skipped.

import {clientsClaim} from 'workbox-core';
import {ExpirationPlugin} from 'workbox-expiration';
import {createHandlerBoundToURL, precacheAndRoute} from 'workbox-precaching';
import {registerRoute} from 'workbox-routing';
import {CacheFirst, StaleWhileRevalidate} from 'workbox-strategies';

import {AlertConfig, alertConfigMessageType, rideConfig, swMessage} from "./api/alertConfig";
import {Mutex} from "async-mutex";
import {rideTime} from "./api/queueAlertAccess";
import * as localforage from 'localforage'
import {toByteArray} from 'base64-js'
import {decompressSync, strFromU8} from "fflate";

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

// Precache all of the assets generated by your build process.
// Their URLs are injected into the manifest variable below.
// This variable must be present somewhere in your service worker file,
// even if you decide not to use precaching. See https://cra.link/PWA
precacheAndRoute(self.__WB_MANIFEST);

// Set up App Shell-style routing, so that all navigation requests
// are fulfilled with your index.html shell. Learn more at
// https://developers.google.com/web/fundamentals/architecture/app-shell
const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$');
registerRoute(
    // Return false to exempt requests from being fulfilled by index.html.
    ({request, url}: { request: Request; url: URL }) => {
        // If this isn't a navigation, skip.
        if (request.mode !== 'navigate') {
            return false;
        }

        // If this is a URL that starts with /_, skip.
        if (url.pathname.startsWith('/_')) {
            return false;
        }

        // If this looks like a URL for a resource, because it contains
        // a file extension, skip.
        if (url.pathname.match(fileExtensionRegexp)) {
            return false;
        }

        // Return true to signal that we want to use the handler.
        return true;
    },
    createHandlerBoundToURL(process.env.PUBLIC_URL + '/index.html')
);

// An example runtime caching route for requests that aren't handled by the
// precache, in this case same-origin .png requests like those from in public/
registerRoute(
    // Add in any other file extensions or routing criteria as needed.
    ({url}) => url.origin === self.location.origin && url.pathname.endsWith('.png'),
    // Customize this strategy as needed, e.g., by changing to CacheFirst.
    new StaleWhileRevalidate({
        cacheName: 'images',
        plugins: [
            // Ensure that once this runtime cache reaches a maximum size the
            // least-recently used images are removed.
            new ExpirationPlugin({maxEntries: 50}),
        ],
    })
);

// Cache rides page
registerRoute(
    ({url}) => url.pathname.startsWith('/allParks'),

    new CacheFirst()
);

// This allows the web app to trigger skipWaiting via
// registration.waiting.postMessage({type: 'SKIP_WAITING'})
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/* eslint-disable no-restricted-globals */

/** Actual Logic **/

/**
 * Locks write access to `config` when config is being read.
 */
let configMutex: Mutex = new Mutex() //TODO remove this

/** Loads the config from the db if it exists. Will be null if not set. */
function loadConfig() {
    return configMutex.runExclusive(() => {//The mutex will sync us and ensure this write occurs before the first read
        return localforage.getItem('config').then((conf) => {
            console.debug(`Loaded ${conf} from indexDB`)
            return conf as unknown as AlertConfig | null
        })
    })
}

function handlePush(payload: rideTime[], config: AlertConfig | null) {

    //Use our own badges and tag each ride to avoid reporting the same ride more than once.
    const notificationConfig = {
        icon: "/icons/queueLogo@0,33x.png",
        badge: "/icons/apple-icon-72x72.png",
    }

    return configMutex.runExclusive(async () => {
        console.debug("Starting handler")
        console.debug(`Config: ${JSON.stringify(config)}`)
        console.debug(`Payload: ${JSON.stringify(payload)}`)

        let notified = false

        let rideConfigs: null | rideConfig[]
        if (config == null) {
            rideConfigs = []
        } else {
            rideConfigs = config[1]
        }

        //Check times for all rides we're waiting on. The server will send a ride only if it will alert
        for (const rideConf of rideConfigs) {
            console.debug(`Checking ride ${rideConf.rideName} for ${rideConf.alertOn}`)

            //Attempt to find same ride from server
            let serverRide = payload.find(r => r.name === rideConf.rideName)
            console.debug(`server equivalent: ${serverRide?.status}`)

            //Skip if server didn't send ride/park
            if (serverRide == null) continue

            //Handle alert conditions
            switch (rideConf.alertOn) {
                case "Open":
                    console.debug(`handling open case`)
                    if (serverRide.status !== "Closed") {
                        //Output current wait if we can
                        if (typeof serverRide.status !== "string") {
                            await (self as any).registration.showNotification('Ride Alert', {
                                body: `${rideConf.rideName} is Open with a wait of ${serverRide.status.Wait} minutes!`,
                                ...notificationConfig,
                                tag: `${rideConf.rideName}`
                            })
                            notified = true
                        } else {
                            await (self as any).registration.showNotification('Ride Alert', {
                                body: `${rideConf.rideName} is Open!`,
                                ...notificationConfig,
                                tag: `${rideConf.rideName}`
                            })
                            notified = true
                        }
                    }
                    break;
                case "Closed":
                    console.debug(`handling closed case`)
                    if (serverRide.status === "Closed") {
                        await (self as any).registration.showNotification('Ride Alert', {
                            body: `${rideConf.rideName} is Closed!`,
                            ...notificationConfig,
                            tag: `${rideConf.rideName}`
                        })
                        notified = true
                    }
                    break;
                default: //Configured for a time
                    console.debug(`handling waittime case`)
                    if (typeof serverRide.status !== "string" && serverRide.status.Wait <= rideConf.alertOn.wait) {
                        await (self as any).registration.showNotification('Ride Alert', {
                            body: `${rideConf.rideName}'s wait is ${serverRide.status.Wait} minutes!`,
                            ...notificationConfig,
                            tag: `${rideConf.rideName}`
                        })
                        notified = true
                    }
                    break;
            }
        }

        if (!notified) {
            await (self as any).registration.showNotification('Oops', {
                body: 'Somehow you managed to get a config desynced from the server! Heres a notification so Apple devices wont disable the app. Theres no need for you to do anything, this should resolve itself.',
                ...notificationConfig
            })
        }
    });
}

/**
 * Run whenever the backend sends a new array of rideTimes.
 */
(self as any).addEventListener('push', async (event: PushEvent) => {
    //Decompress the zlib encoded data
    const unBase64 = toByteArray(event.data.text())
    const raw = decompressSync(unBase64)

    //Recreate and parse the JSON
    const payload = JSON.parse(strFromU8(raw)) as rideTime[]

    console.debug("received push from server")

    event.waitUntil(loadConfig().then(config => handlePush(payload, config)))
});

/**
 * Handle new config being sent from frontend.
 */
self.addEventListener('message', async (event) => {
    let message = event.data as swMessage<alertConfigMessageType>

    if (message.type === 'setConfig') {
        console.debug("Got new config")

        await configMutex.runExclusive(async () => {
            //Persist config in Db
            await localforage.setItem('config', message.message as AlertConfig)
        })
    }
})

/**
 * Handle client requesting config.
 */
self.addEventListener('message', async (event) => {
    let message = event.data as swMessage<alertConfigMessageType>

    let config = await loadConfig()

    if (message.type === 'getConfig') {
        console.debug(`Client requested config. sending ${config}`)
        await configMutex.runExclusive(async () => {
            let allClients = await (self as unknown as ServiceWorkerGlobalScope).clients.matchAll()

            //Post to all clients
            for (const client of allClients) {
                client.postMessage(config)
            }
        })
    }
})

/**
 * Open the app when a notification is clicked, and remove notification.
 */
self.addEventListener('notificationclick', async (event) => {
    const clickedNotification = event.notification;
    clickedNotification.close();

    const urlToOpen = new URL('/', self.location.origin).href;

    const promiseChain = self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then((windowClients) => {
        let matchingClient = null;

        for (let i = 0; i < windowClients.length; i++) {
            const windowClient = windowClients[i];
            if (windowClient.url === urlToOpen) {
                matchingClient = windowClient;
                break;
            }
        }

        if (matchingClient) {
            return matchingClient.focus();
        } else {
            return self.clients.openWindow(urlToOpen);
        }
    });

    event.waitUntil(promiseChain);
})


interface PushMessageData {
    arrayBuffer(): ArrayBuffer;

    blob(): Blob;

    json(): any;

    text(): string;
}

interface PushEvent extends ExtendableEvent {
    data: PushMessageData;
}

interface ExtendableEvent extends Event {
    waitUntil(fn: Promise<any>): void;
}