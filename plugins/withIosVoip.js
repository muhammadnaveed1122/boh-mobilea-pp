/**
 * Inline Expo config plugin — iOS PushKit VoIP wake wiring.
 *
 * Enables incoming-call wakes on iOS (killed / backgrounded) via APNs PushKit,
 * which is the only Apple-sanctioned channel and the prerequisite for the
 * CallKit incoming UI + Dynamic Island call pill. iOS does NOT use FCM (Firebase
 * is stripped from the iOS build — see app.config.js), so the wake path is raw
 * PushKit through `react-native-voip-push-notification` + `react-native-callkeep`.
 *
 * This plugin injects, on every `expo prebuild` (ios/ is gitignored):
 *  1. Bridging-header imports for the two ObjC pods. The iOS build runs WITHOUT
 *     `use_frameworks!` (app.config.js strips it), so the pods are static libs
 *     exposed to Swift via the bridging header, not Swift modules — hence
 *     `#import`, not `import RNCallKeep`.
 *  2. AppDelegate (Swift) PushKit registration + `PKPushRegistryDelegate`:
 *     - `RNVoipPushNotificationManager.voipRegistration()` in didFinishLaunching.
 *     - `didUpdate pushCredentials` → forward the VoIP token to JS (the
 *       `register` event the token hook listens for).
 *     - `didReceiveIncomingPush` → **synchronously report the call to CallKit**
 *       via `RNCallKeep.reportNewIncomingCall(...withCompletionHandler:)` BEFORE
 *       the push completion runs. Apple terminates (and eventually blacklists)
 *       apps that don't report a CallKit call for every VoIP push. The JS side
 *       (`voip-push-ios.ts`) then drives the SIP/coordinator state.
 *
 * iOS-only: `withAppDelegate` / the ios dangerous-mod are skipped on Android.
 *
 * NOTE: This is the most build-environment-sensitive step in the calling stack.
 * The exact Swift bridged names of the `RNVoipPushNotificationManager` class
 * methods (`didUpdate(_:forType:)`, `didReceiveIncomingPush(withPayload:forType:)`)
 * and the bridging-header import style depend on the pod versions / whether
 * use_frameworks is on. Validate the generated AppDelegate compiles after
 * `expo prebuild --clean` and adjust if Xcode reports an unresolved symbol.
 */
const fs = require('node:fs');
const path = require('node:path');
const { withAppDelegate, withDangerousMod } = require('expo/config-plugins');

const SENTINEL = '// withIosVoip:injected';

const BRIDGING_IMPORTS = [
  '',
  SENTINEL,
  '#import <PushKit/PushKit.h>',
  '#import "RNCallKeep.h"',
  '#import "RNVoipPushNotificationManager.h"',
  '',
].join('\n');

// CRITICAL: RNCallKeep.setup MUST run natively at launch. The CXProvider
// delegate (which handles + fulfills the CallKit Answer/End actions) is only
// attached inside RNCallKeep's instance init — which otherwise happens when the
// RN bridge boots. On a killed-app VoIP wake the user taps Answer BEFORE that,
// so the CXAnswerCallAction has no delegate, is never fulfilled, the call never
// reaches hasConnected, and JS never hears about the answer. Native setup
// attaches the delegate immediately (and marks isSetupNatively so the JS-side
// setup becomes a harmless no-op). Keep these options in sync with
// CALLKEEP_OPTIONS.ios in src/features/callService/services/callkeep.ts.
const VOIP_REGISTRATION = [
  '    RNCallKeep.setup([',
  '      "appName": "RHK Properties",',
  '      "supportsVideo": false,',
  '      "maximumCallsPerCallGroup": "1",',
  '      "maximumCallGroups": "1",',
  '      "includesCallsInRecents": true,',
  '    ])',
  '    RNVoipPushNotificationManager.voipRegistration()',
].join('\n');

const DELEGATE_EXTENSION = `
${SENTINEL}
import PushKit

extension AppDelegate: PKPushRegistryDelegate {
  public func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    RNVoipPushNotificationManager.didUpdate(pushCredentials, forType: type.rawValue)
  }

  public func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {}

  public func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    let dict = payload.dictionaryPayload
    let uuid = (dict["uuid"] as? String) ?? UUID().uuidString
    let handle = (dict["call_handle"] as? String) ?? "unknown"
    let callerName = (dict["caller_name"] as? String) ?? "Incoming call"

    // Apple REQUIRES a CallKit report for every VoIP push, synchronously, before
    // the completion handler runs — otherwise the app is terminated / blacklisted.
    RNCallKeep.reportNewIncomingCall(
      uuid,
      handle: handle,
      handleType: "generic",
      hasVideo: false,
      localizedCallerName: callerName,
      supportsHolding: true,
      supportsDTMF: true,
      supportsGrouping: false,
      supportsUngrouping: false,
      fromPushKit: true,
      payload: dict,
      withCompletionHandler: completion
    )

    // Hand the same push to JS so voip-push-ios.ts can drive the SIP side.
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)
  }
}
`;

/** Append the ObjC pod headers to the Swift bridging header (idempotent). */
function withVoipBridgingHeader(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const iosDir = cfg.modRequest.platformProjectRoot;
      const header = findBridgingHeader(iosDir);
      if (!header) {
        console.warn(
          '[withIosVoip] No *-Bridging-Header.h found — skipping bridging imports. ' +
            'Add #import "RNCallKeep.h" and #import "RNVoipPushNotificationManager.h" manually.',
        );
        return cfg;
      }
      const contents = fs.readFileSync(header, 'utf8');
      if (!contents.includes(SENTINEL)) {
        fs.writeFileSync(header, contents + BRIDGING_IMPORTS, 'utf8');
      }
      return cfg;
    },
  ]);
}

/** Locate the Swift bridging header anywhere under ios/ (name varies by slug). */
function findBridgingHeader(iosDir) {
  let found = null;
  const walk = (dir) => {
    if (found) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (found) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'Pods' || entry.name === 'build') continue;
        walk(full);
      } else if (entry.name.endsWith('-Bridging-Header.h')) {
        found = full;
      }
    }
  };
  walk(iosDir);
  return found;
}

/** Inject VoIP registration + the PKPushRegistryDelegate extension into AppDelegate.swift. */
function withVoipAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    const { language } = cfg.modResults;
    let contents = cfg.modResults.contents;

    if (language !== 'swift') {
      console.warn(
        `[withIosVoip] AppDelegate language is "${language}", expected "swift". ` +
          'Skipping injection — wire PushKit manually for ObjC.',
      );
      return cfg;
    }
    if (contents.includes(SENTINEL)) return cfg; // idempotent

    // 1. Register for VoIP pushes inside didFinishLaunchingWithOptions.
    contents = contents.replace(
      /(didFinishLaunchingWithOptions[^{]*\{)/,
      `$1\n${VOIP_REGISTRATION}\n`,
    );

    // 2. Append the delegate extension at end of file.
    contents = `${contents}\n${DELEGATE_EXTENSION}`;

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withIosVoip(config) {
  config = withVoipBridgingHeader(config);
  config = withVoipAppDelegate(config);
  return config;
};
