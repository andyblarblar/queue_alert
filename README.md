# **![Q](https://github.com/andyblarblar/queue_alert/blob/master/queue_alert_frontend/app/public/icons/android-icon-36x36.png)ueue Alert**
Queue Alert is a Progressive Web App (PWA) that provides the ability to receive push notifications when an amusement ride is under a certain wait time 🎢

**Features:**
- **Flexible notifications** - Configure alerts on rides opening, closing, or reaching a certain wait time. This is a feature not found in many official apps!
- **Cross-platform** - The webapp works on Safari, Chrome, and Firefox on both iOS and Android
- **Native Alerts** - Native push notifications are used (via web push), so Queue Alert can be managed like any other app
- **One app to rule them all** - Queue Alert can be used with a massive variety of parks, removing the need to install an app for each park you visit

## Minimum requirements
> Note: iOS requires this site to be added as an app to the home screen for notifications to work.

- Chrome 50 or Firefox 44 on Android or desktop OS
- iOS 16.4 with any browser on iOS

## Overview
Queue Alert is split between its frontend and backend server. The backend is an actix-web API that takes in user configurations and push endpoints, and sends relevant wait times
to the client when their configurations conditions are met. It uses a SQLite database for persistence.

The frontend is a Reactjs PWA, where the user creates their configuration. It is designed to be straightforward and easy to use, since the main feature of Queue Alert is that
the real information is delivered in push notifications asynchronously.

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
