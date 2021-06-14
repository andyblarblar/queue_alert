/*
 * Copyright (c) 2021. Andrew Ealovega
 */
import {Ok, Err, Result, Option, Some, None} from "ts-results";


//*Application code*

//Global setup
/** This clients push subscription. null if not subscribed.*/
let pushSub: PushSubscription

//First setup service worker
async function main() {
    (await registerServiceWorker()).expect("Unable to create service worker!");
}

main().catch()

//Add sub events
const subBtn = document.getElementById("sub-btn");
subBtn.addEventListener('click', async () => {
    let permRes = await askPermission();

    permRes.expect("User rejected notifications!")

    pushSub = await subscribeUserToPush();
    let res = await registerWithBackend(pushSub);

    if (res.ok) {
        console.log("Connected to queue alert")
    }
    else if (res.err){
        console.error(`Failed to register with queue alert! Err code: ${res.val}`)
    }
});

const unsubBtn = document.getElementById("unsub-btn");
unsubBtn.addEventListener('click', async () => {
    //Return if not subscribed
    if (pushSub == null) {
        console.trace("Not subbed, ignoreing unsub btn")
        return
    }
    await unsubscribeUserFromPush(pushSub);
    let backRes = await unregisterWithBackend(pushSub);

    //null sub
    pushSub = null

    if(backRes.ok){
        console.log("unregistered from queue alert")
    }
    else {
        console.error("Failed to unsub from queue alert!")
    }
});

const pingBtn = document.getElementById("pingus");
pingBtn.addEventListener('click', async () => {
    await ping()
});

//*Lib code*

async function ping() {
    await fetch('./ping')
}

/**
 * Attempts to download and register a service worker.
 * @return Either the registered service worker, or the error that occurred while registering.
 */
function registerServiceWorker(): Promise<Result<ServiceWorkerRegistration, Error>> {
    return navigator.serviceWorker.register('/serviceWorker.js')
        .then((registration) => {
            console.log('Service worker successfully registered.');
            return Ok(registration)
        })
        .catch((err) => {
            console.error('Unable to register service worker.', err);
            return Err(err)
        });
}

/**
 * Asks for permission to send notifications.
 * @return Ok if granted, Err otherwise.
 */
async function askPermission(): Promise<Result<null, null>>{
    let result = await Notification.requestPermission();

    if (result === "granted") {
        return Ok(null)
    }
    else {
        return Err(null)
    }
}

/**
 * Subscribes client to the browsers push service. Must have a registered service worker first.
 */
async function subscribeUserToPush(): Promise<PushSubscription> {
    const worker = await navigator.serviceWorker.getRegistration('/');

    //Check if already subscribed
    if (await worker.pushManager.getSubscription() !== null) {
        const sub = await worker.pushManager.getSubscription();
        console.log('Client was already subscribed: ', JSON.stringify(sub));
        return sub
    }

    //Get servers public key via API call
    const response = await fetch('./vapidPublicKey');
    const vapidPublicKey = await response.text();
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);//Convert from base64 for chrome compatibility

    const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
    };

    const sub = await worker.pushManager.subscribe(subscribeOptions);
    console.log('Received new PushSubscription: ', JSON.stringify(sub));
    return sub;
}

async function unsubscribeUserFromPush(sub: PushSubscription) {
    await sub.unsubscribe()

    console.debug("unsubbed from push")
}

/**
 * Registers this user with the queue alert backend, causing the server to send notifications.
 * @param subscription The subscription object associated with this user.
 * @return Ok if 200, Err if any other http code, returns that other number.
 */
async function registerWithBackend(subscription: PushSubscription): Promise<Result<null, number>> {

    const body = JSON.stringify(subscription);

    const res = await fetch('./register', {
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
 * @return Ok if 200, Err if any other http code, returns that other number.
 */
async function unregisterWithBackend(subscription: PushSubscription): Promise<Result<null, number>> {
    const res = await fetch('./unregister', {
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

function showNotification(title: string, body: string, iconUrl?: string ) {
    const options = {
        body: body,
        icon: iconUrl
    };

    console.trace("displaying notification")
    new Notification(title,options)
}

/**
 * Converts a base64 encoded url safe byte array into a Uint8Array.
 * @param base64String base64 encoded array.
 */
function urlBase64ToUint8Array(base64String: string) {
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