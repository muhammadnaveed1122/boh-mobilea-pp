// Dynamic Expo config. Two iOS-only adjustments on top of app.json:
//
// 1. Strip Firebase/calling from iOS. Calling is Android-only for now (iOS uses
//    PushKit/CallKit, a later guide), and the RNFirebase iOS pods don't build
//    under RN 0.81 + `use_frameworks!` (React-Core headers fail: `RCT_EXTERN
//    unknown`, `RCT_EXPORT_METHOD` macro errors). So on iOS we drop the Firebase
//    config plugins, our Android/Firebase-only inline plugins, and the
//    `ios.useFrameworks` build property (only the Firebase pods needed it). The
//    pods themselves are excluded from iOS autolinking via the
//    `expo.autolinking.apple.exclude` field in package.json (Expo SDK 54 ignores
//    react-native.config.js dependency exclusions). The JS packages still resolve
//    on iOS, used only behind `Platform.OS` guards.
//
// OS push is ENABLED: the paid Apple team (RHK Properties LLC) has the Push
// Notifications capability on the `com.rhkproperties.mobile` App ID, so
// `expo-notifications` keeps its auto-injected `aps-environment` entitlement and
// iOS dev builds sign against the paid-team provisioning profile. (Previously,
// on a free/personal team, this config stripped that entitlement because a
// personal-team profile rejects it.)

const IOS_DROP_PLUGINS = new Set([
  '@react-native-firebase/app',
  '@react-native-firebase/messaging',
  './plugins/withCallKeep',
  './plugins/withFirebaseStaticFix',
]);

// Per-environment app identity. QA and PROD must be DIFFERENT apps on the device
// so a push token minted against one environment can never be delivered to the
// other (iOS routes push by bundle identifier; Android by package name). Sharing
// one identity is what let stale QA tokens keep ringing a PROD install. Selected
// by APP_ENV (set per EAS build profile in eas.json); defaults to 'qa' so no
// local/dev build can accidentally claim the live production identity.
const APP_IDENTITY = {
  production: {
    name: 'RHK Properties',
    bundleIdentifier: 'com.rhkproperties.mobile',
    package: 'com.rhkproperties.mobile',
  },
  qa: {
    name: 'RHK Properties QA',
    bundleIdentifier: 'com.rhkproperties.mobile.qa',
    package: 'com.rhkproperties.mobile.qa',
  },
};

// Firebase native config is bundle-id/package specific — a QA build signed with
// the QA package MUST use the QA Firebase files or the Android google-services
// Gradle plugin fails ("No matching client found for package name ...") and FCM
// tokens mint against the wrong (prod) sender, which is what let QA and PROD
// pushes cross-fire. Selected by APP_ENV, mirroring APP_IDENTITY. See
// firebase/README.md for how to populate each folder.
const FIREBASE_FILES = {
  production: {
    ios: './firebase/prod/GoogleService-Info.plist',
    android: './firebase/prod/google-services.json',
  },
  qa: {
    ios: './firebase/qa/GoogleService-Info.plist',
    android: './firebase/qa/google-services.json',
  },
};

// Separate EAS project per environment. The EAS projectId scopes Expo push
// credentials (APNs key / FCM key) and OTA — `getExpoPushTokenAsync({ projectId })`
// mints the Expo push token against THIS id, so a QA token can never be pushed
// through the prod project. Building with APP_ENV=qa uploads to the QA project.
// Both projects must live under the same EAS account as `owner` in app.json.
// `slug` MUST match the slug of the project the id points to, or EAS errors
// ("Slug for project ... does not match the slug field").
const EAS_PROJECT = {
  production: { id: '9e4196d7-64ad-4223-8522-aa35ff6f0fcf', slug: 'rhk-properties' },
  qa: { id: '823f8a9a-74da-4bb1-840f-16d766e9e597', slug: 'rhk-properties-qa' },
};

function resolveAppEnv() {
  const env = process.env.APP_ENV;
  return env === 'production' ? 'production' : 'qa';
}

// Apply the environment's identity (name + bundle id / package) onto the config.
function applyEnvIdentity(config) {
  const env = resolveAppEnv();
  const identity = APP_IDENTITY[env];
  const firebase = FIREBASE_FILES[env];
  config.name = identity.name;
  config.ios = {
    ...config.ios,
    bundleIdentifier: identity.bundleIdentifier,
    googleServicesFile: firebase.ios,
  };
  config.android = {
    ...config.android,
    package: identity.package,
    googleServicesFile: firebase.android,
  };
  config.slug = EAS_PROJECT[env].slug;
  config.extra = {
    ...config.extra,
    eas: { ...config.extra?.eas, projectId: EAS_PROJECT[env].id },
  };
  return config;
}

// Universal Links / App Links are PRODUCTION-ONLY. rhkproperties.com publishes association files
// (/.well-known/apple-app-site-association and /assetlinks.json) that name the production bundle id
// and its signing certificate only — the QA app can never pass verification against them, so the
// declarations are dead weight on a QA build at best. On iOS they are worse than dead weight: the
// `associatedDomains` entitlement requires the Associated Domains capability on the App ID, so
// leaving it on `com.rhkproperties.mobile.qa` would make QA provisioning-profile generation fail.
// Stripped here rather than duplicated across app.json so production stays the declarative default.
function stripAppLinksOutsideProduction(config) {
  if (resolveAppEnv() === 'production') return config;
  const { associatedDomains, ...iosRest } = config.ios ?? {};
  const { intentFilters, ...androidRest } = config.android ?? {};
  config.ios = iosRest;
  config.android = androidRest;
  return config;
}

function detectPlatform() {
  if (process.env.EXPO_PLATFORM) return process.env.EXPO_PLATFORM;
  const argv = process.argv;
  if (argv.some((a) => a === 'ios' || a.endsWith(':ios'))) return 'ios';
  if (argv.some((a) => a === 'android' || a.endsWith(':android'))) return 'android';
  return null;
}

function stripIosFirebase(plugins) {
  return (plugins ?? [])
    .filter((p) => !IOS_DROP_PLUGINS.has(Array.isArray(p) ? p[0] : p))
    .map((p) => {
      if (Array.isArray(p) && p[0] === 'expo-build-properties' && p[1]?.ios) {
        const { useFrameworks, ...iosRest } = p[1].ios;
        return ['expo-build-properties', { ...p[1], ios: iosRest }];
      }
      return p;
    });
}

// Inject the Google Maps API key from env into both platforms' native config.
// Static app.json can't read process.env (the `$EXPO_PUBLIC_*` literal there is
// never substituted), so resolve it here where env vars are available. Android
// reads `android.config.googleMaps.apiKey`; iOS reads `ios.config.googleMapsApiKey`.
// Both are required for `PROVIDER_GOOGLE` to render tiles.
function injectGoogleMapsKey(config) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return config;
  config.ios = {
    ...config.ios,
    config: { ...config.ios?.config, googleMapsApiKey: apiKey },
  };
  config.android = {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: { ...config.android?.config?.googleMaps, apiKey },
    },
  };
  return config;
}

module.exports = ({ config }) => {
  if (detectPlatform() === 'ios') {
    config.plugins = stripIosFirebase(config.plugins);
  }
  applyEnvIdentity(config);
  stripAppLinksOutsideProduction(config);
  return injectGoogleMapsKey(config);
};
