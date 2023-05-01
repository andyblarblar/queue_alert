/*
 * Copyright (c) 2021. Andrew Ealovega
 */

import {Err, Ok, Result} from "ts-results";

/**
 * Tuple of {parkname, all rides for that park}. alertOn number is always the wait in minutes.
 */
export type AlertConfig = [string, rideConfig[]]

export type rideConfig = { rideName: string, alertOn: "Open" | "Closed" | { wait: number } }

/**
 * Message format for communicating with SW. Set generic to discriminated union of possible message types.
 */
export type swMessage<T> = { type: T, message: unknown }

/**
 * type is one of:
 * setConfig - set a new config on the SW. message is type AlertConfig.
 * getConfig - get the SW config. message is null.
 */
export type alertConfigMessageType = 'setConfig' | 'getConfig'

/**
 * Posts a config to the serviceworker, changing the rides the user is alerting on.
 * @param config An array of all rides to alert on.
 */
export async function sendConfigToSW(config: AlertConfig): Promise<Result<null, Error>> {
    let SW = await navigator.serviceWorker.getRegistration('/')

    if (SW?.active == null) { return Err(new Error("No serviceworker registered. Try reloading the page. If this doesn't work, your browser may be out of date.")) }

    SW.active.postMessage({ type: 'setConfig', message: config })

    console.debug("Posted new config to SW")

    return Ok(null)
}

/**
 * Asks the serviceworker for its copy of the config. This can be used to load the config after a full app
 * reload, for example.
 * @returns The config if set, null if not, or no SW.
 */
export async function getConfigFromSW(): Promise<AlertConfig | null> {
    let SW = await navigator.serviceWorker.getRegistration('/')

    if (SW == null) {
        console.debug('Failed to get SW when asking for config')
        return null
    }

    //Wrap response event in promise to make async
    let responsePromise = new Promise(async (resolve, reject) => {
        let config2 = undefined //localforge returns null on not set, so it will never return undefined.

        //Set config when received 
        const onResponse = (ev: MessageEvent<any>) => {
            console.debug('got config from SW message')
            config2 = ev.data as AlertConfig | null
            console.debug(`got config from SW ${config2}`)
        }

        navigator.serviceWorker.addEventListener('message', onResponse)

        //Spin until we get a response
        while (config2 === undefined) {
            await sleep(5)
        }

        //Cleanup handle
        navigator.serviceWorker.removeEventListener('message', onResponse)

        resolve(config2)
    })

    //Send message and wait until we get a response
    SW!.active!.postMessage({ type: 'getConfig', message: null })
    const config = await responsePromise

    return config as AlertConfig | null
}

async function sleep(msec: number) {
    return new Promise(resolve => setTimeout(resolve, msec));
}