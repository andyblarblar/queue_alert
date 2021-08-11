# **![Q](https://github.com/andyblarblar/queue_alert/blob/master/queue_alert_frontend/app/public/icons/android-icon-36x36.png)ueue Alert**
Queue Alert is a Progressive Web App (PWA) that will send notifications whenever an amusement ride reaches a certain wait-time threshold. 
This app was inspired by a particularly windy trip to Cedar Point, where I spent all day checking Queue Times on my phone while waiting for SteVe to open. 
Queue Alert aims to be a mobile first, streamlined, and ergonomic solution to automate checking wait times such that you can spend less time checking your phone, 
and more time enjoying your visit.

## Overview
Queue Alert is split between its frontend and backend server. The backend is an actix web server that handles scraping of data from queue times and sending of that data to registered
push endpoints. This is done using the queue_times crate found in this repo, and [rust web push](https://github.com/pimeys/rust-web-push).

The frontend is a Reactjs PWA, which registers with the backend to enable the push notifications at the heart of Queue Alert. It is designed to be mobile first, and is optimised
for quick painless interactions to minimise time spent in the app. 

## Building
To build the app for yourself, you're going to first need to change the endpoint in [app.tsx](https://github.com/andyblarblar/queue_alert/blob/206a423645503f2500622e37cb44984b6f9a7f6b/queue_alert_frontend/app/src/App.tsx#L72)
to the endpoint of your server. *This endpoint must be HTTPS or else the service worker will not register.* You can also just make this localhost for testing.
Now just `npm build` the package and save the output for later.

The server currently only has configs for localhost and use in iis. To enable iis support, use the `iis_host` feature. Without this feature, it will simply host on http://localhost:8080.
Once this is chosen, just `cargo build --release` the top directory. 

Now that you have both halves, move your exe to its final location and copy the contents of the npm build into the same directory in a diretory called 'www'.
Finally, generate your servers private key using the command `openssl ecparam -genkey -name prime256v1 -out private_key.pem`. (This just generates a PKCS#8 P256 curve ECDH, you don't have to use openssl.)

Now just start the server and it should just work! Logs are just created using stdout.

## Issues
If you have any issue with the app (I'm not looking for server feature requests) feel free to open an issue with steps to reproduce and your browser version. 
