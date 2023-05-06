# Architecture

Sequence of client building a config to receiving a notification:
```mermaid
sequenceDiagram
autonumber

    participant H as Host Device
    participant SW as Service Worker
    participant B as Browser
    participant S as Server
    participant QT as Queue Times Site
    participant WP as Web Push Server
    participant DB as SQLite Database

    B->>+S: Request ride times for park
    alt cache is outdated
        S->>+QT: Scrape queue times page for park
        QT-->>-S: Cache queue times received
    end
    S-->>-B: Respond with all ride times for park
    B->>B: Browser builds config as user selects rides 
    alt if no push subscription
        B->>+WP: Request push subscription
        WP-->>-B: pushSubscription object
    end
    B-)+S: Send config and push endpoint to server
    S-)-DB: Persist config and endpoint in DB
    B-)SW: Persist config in IndexedDB

    loop every minute
        alt cache is outdated
        S->>+QT: Scrape queue times page for park
        activate S
        QT-->>-S: Cache queue times received
        end
        S->>+WP: Send current ride times for all rides in users config that have met their condition
        deactivate S
        WP-->>-SW: Forwards
        SW->>H: Prompt notification for each ride
        S-)DB: Remove all endpoints that no longer accept our pushes
    end
```

## Endpoints

- `/userCount`
  - Get: Returns a body containing the current number of active users
- `/vapidPublicKey`
  - Get: Returns a body containing a base64 encoded public key for VAPID encrypting push notifications
- `/register`
  - Post: Takes JSON containing a pushSubscription and Queue Alert config and registers that push endpoint as a unique user, or updates that endpoints config if that endpoint is already registered. This endpoint will receive notifications derived from its associated config until unregistered.
- `/unregister`
  - Post: Takes JSON containing a pushSubscription, and removes that endpoint and its configuration from the server.
- `/allParks`
  - Get: Returns JSON mapping park names to queue times urls
- `/parkWaitTimes?url={}`
  - Get: Responds with a sorted JSON array of ride wait times for the url in the url query parameter. 