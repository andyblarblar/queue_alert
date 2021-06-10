/*
 * Copyright (c) 2021. Andrew Ealovega
 */

self.addEventListener('push', function(event: PushEvent) {
    const payload = event.data ? event.data.text() : 'no payload';
    event.waitUntil(
        (<any>self).registration.showNotification('queue alert', {
            body: payload,
        })
    );
});

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