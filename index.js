// True JS entry point (package.json "main").
//
// Registers the FCM background/headless handler BEFORE loading the expo-router
// entry, so it runs in the headless (killed-app) runtime too. Previously the
// handler was registered only in `app/_layout.tsx`, which the router evaluates
// just before mounting UI — but a killed-app FCM wake boots a HEADLESS JS task
// with no UI, so _layout never loaded, the background handler never registered,
// and RNFB logged "No task registered for key ReactNativeFirebaseMessagingHeadlessTask"
// → the incoming call never rang. `require` ordering guarantees registration
// happens before the router entry evaluates. Android-only no-op elsewhere.
const {
  registerCallBackgroundHandler,
} = require('./src/features/callService/services/fcm-call-messaging');

registerCallBackgroundHandler();

require('expo-router/entry');
