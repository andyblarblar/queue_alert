/*
 * Copyright (c) 2021. Andrew Ealovega
 */

/* eslint-disable no-restricted-globals */
import { AlertConfig, alertConfigMessageType, swMessage } from "./alertConfig";
import { Mutex } from "async-mutex";
import { rideTime } from "./queueAlertAccess";
import * as localforage from 'localforage'

/** Actual Logic **/

/** Loads the config from the db if it exists. Will be null if not set. */
function loadConfig() {
    let dbConfig
    localforage.getItem('config').then((conf) => {
        dbConfig = conf
    })
    return dbConfig as unknown as AlertConfig | null
}

/**
 * Current config of rides to alert on. Null if not set. This will be updated via messages from the client, and persisted in
 * IndexedDb.
 */
let config: AlertConfig | null = loadConfig()

/**
 * Locks write access to `config` when config is being read.
 */
let configMutex: Mutex = new Mutex()

function handlePush(payload: rideTime[], event: PushEvent) {
    /**Used to ensure the user only gets default message if none was sent.*/
    let notified = false

    return configMutex.runExclusive(async () => {
        //Check times for all rides we're waiting on.
        for (const [, rideConfigs] of Object.entries(config ?? [])) {

            for (const rideConfig of rideConfigs as { rideName: string, alertOn: "Open" | "Closed" | number }[]) {
                //Attempt to find same ride from server
                let serverRide = payload.find(r => r.name === rideConfig.rideName)

                //Skip if server didn't send ride/park
                if (serverRide == null) continue

                //Handle alert conditions
                switch (rideConfig.alertOn) {
                    case "Open":
                        if (serverRide.status !== "Closed") {
                            //Output current wait if we can
                            if (typeof serverRide.status !== "string") {
                                await (self as any).registration.showNotification('queue alert', {
                                    body: `${rideConfig.rideName} is Open with a wait of ${serverRide.status.Wait} minutes!`,
                                })
                                notified = true
                            } else {
                                await (self as any).registration.showNotification('queue alert', {
                                    body: `${rideConfig.rideName} is Open!`,
                                })
                                notified = true
                            }
                        }
                        break;
                    case "Closed":
                        if (serverRide.status === "Closed") {
                            await (self as any).registration.showNotification('queue alert', {
                                body: `${rideConfig.rideName} is Closed!`,
                            })
                            notified = true
                        }
                        break;
                    default: //Configured for a time
                        if (typeof serverRide.status !== "string" && serverRide.status.Wait <= rideConfig.alertOn) {
                            await (self as any).registration.showNotification('queue alert', {
                                body: `${rideConfig.rideName}'s wait is ${serverRide.status.Wait} minutes!`,
                            })
                            notified = true
                        }
                        break;
                }
            }
        }
        if (!notified) {
            await (self as any).registration.showNotification('queue alert', {
                body: `No conditions met ¯\\_(ツ)_/¯`//This must be sent to fulfill push api as it must make a notification
            })
        }
    });
}

/**
 * Run whenever the backend sends a new array of rideTimes.
 */
(self as any).addEventListener('push', async (event: PushEvent) => {
    //All ridetimes from the server, in the same format as the config
    const payload = await event.data.json() as rideTime[]

    console.debug("received push from server")

    event.waitUntil(handlePush(payload, event))
});

/**
 * Handle new config being sent from frontend.
 */
self.addEventListener('message', async (event) => {
    let message = event.data as swMessage<alertConfigMessageType>

    if (message.type === 'setConfig') {
        console.debug("Got new config")

        await configMutex.runExclusive(async () => {
            config = message.message as AlertConfig

            //Persist config in Db
            await localforage.setItem('config', config)
        })
    }
})

/**
 * Handle client requesting config.
 */
self.addEventListener('message', async (event) => {
    let message = event.data as swMessage<alertConfigMessageType>

    if (message.type === 'getConfig') {
        console.debug("Client requested config")
        await configMutex.runExclusive(async () => {
            let allClients = await (self as unknown as ServiceWorkerGlobalScope).clients.matchAll()

            //Post to all clients
            for (const client of allClients) {
                client.postMessage(config)
            }
        })
    }
})

//TODO move to another file
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