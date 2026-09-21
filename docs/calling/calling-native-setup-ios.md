# Native Calling Setup — iOS (Beginner Guide)

> **⚠️ STATUS (updated): the client-side implementation now exists in code.** The
> JS/native wiring described conceptually below is already implemented:
>
> - `react-native-voip-push-notification` installed (raw APNs PushKit — iOS does
>   **not** use FCM; Firebase stays stripped on iOS).
> - PushKit AppDelegate shim + bridging-header imports injected by
>   [`plugins/withIosVoip.js`](../../plugins/withIosVoip.js) (registered in `app.json`).
> - VoIP wake handler [`src/features/callService/services/voip-push-ios.ts`](../../src/features/callService/services/voip-push-ios.ts),
>   token registration in [`use-register-call-token.ts`](../../src/features/callService/hooks/use-register-call-token.ts).
> - Outbound CallKit `startCall` + connect/end reporting in
>   [`use-call-service.ts`](../../src/features/callService/hooks/use-call-service.ts)
>   (this is what shows the **Dynamic Island** call pill — CallKit drives it automatically).
> - CallKit native-UI events (answer / end / mute / hold on the lock screen +
>   `didActivateAudioSession`) bridged to the SIP brain cross-platform in
>   [`use-callkeep-bridge.ts`](../../src/features/callService/hooks/use-callkeep-bridge.ts);
>   `setupCallKeep()` runs on iOS at app start via that hook.
> - `app.json` already lists `"voip"` under `UIBackgroundModes`.
>
> **What remains is human/ops + backend, not app code:** the VoIP push **auth key**,
> the App ID push capability, and the **backend VoIP push endpoint**. For the
> backend contract see [`calling-backend-voip-push.md`](./calling-backend-voip-push.md).
>
> **DO NOT** `rm app.config.js` (the old §4a below) — it now also strips Firebase
> on iOS to keep the build green. The `"voip"` background mode is already in
> `app.json`. Treat §4a–§5d below as historical/conceptual; the code supersedes them.

This guide takes you from "the foreground-only calling feature works" to "incoming SIP calls ring the phone with the native CallKit UI even when the app is closed or the screen is locked." Written for someone who has **never set up VoIP push or CallKit before**. Follow it top to bottom — don't skip steps.

> **Why this is needed:** sip.js only connects while the app is in the foreground. To ring the phone when the app is killed or the screen is locked, iOS needs a **VoIP push** to wake the app — and a VoIP push needs **PushKit + CallKit**, a paid Apple Developer account, and a special VoIP certificate (different from the normal APNs key used for regular notifications).
>
> Read the architecture context first: [`calling-implementation-guide.md`](./calling-implementation-guide.md) §6. The Android counterpart is [`calling-native-setup-android.md`](./calling-native-setup-android.md). The regular-push iOS guide [`notifications-setup-ios.md`](./notifications-setup-ios.md) is a prerequisite — do that first.

---

## 0. Before you start — what you need

| You need                                        | Why                                                        | Cost         | Where                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| Everything from `notifications-setup-ios.md` §0 | Same Mac/Xcode/CocoaPods/Apple Developer toolchain         | $99/yr Apple | See that guide                                                                  |
| Regular push notifications already working      | VoIP push reuses the same Apple Developer team + Bundle ID | —            | Confirm a normal notification arrives on your iPhone before touching this guide |
| A **physical iPhone**                           | CallKit and VoIP push do **not** work on the Simulator     | —            | —                                                                               |
| Backend with a **VoIP push endpoint**           | The phone-side work is useless until the server can push   | —            | Currently **does not exist** — see §6 for what backend must build               |

### Words you'll see

- **PushKit** = Apple's special push channel for VoIP. Separate from APNs.
- **CallKit** = the native iOS incoming-call UI (full-screen, lock-screen, AirPods/CarPlay routing).
- **VoIP cert** = an Apple-issued `.p12` certificate that authorizes a server to send PushKit pushes. **Not** the same as the `.p8` APNs auth key used for regular notifications.
- **VoIP token** = device-specific push address for PushKit. Different from the regular push token. Hex string, ~64 chars.
- **`react-native-callkeep`** = the JS library that bridges CallKit on iOS / ConnectionService on Android into a single API. Reports `answerCall` / `endCall` events back to JS.
- **VoIP background mode** = an iOS entitlement that allows the app to receive PushKit pushes when killed/backgrounded.

### Useful reference docs (open in tabs)

- Apple — PushKit overview → https://developer.apple.com/documentation/pushkit
- Apple — Voice over IP best practices → https://developer.apple.com/documentation/callkit/voip_best_practices
- react-native-callkeep → https://github.com/react-native-webrtc/react-native-callkeep
- Expo config plugin for callkeep → https://github.com/jamesreggio/expo-config-plugin-react-native-callkeep (or any current fork — verify before installing)

---

## 1. Confirm prerequisites are green (5 min)

Do not start this guide until **all four** are true:

1. ✅ Regular iOS push notifications arrive on your phone (per `notifications-setup-ios.md`).
2. ✅ Foreground SIP calls work between two SIP extensions (per `calling-setup-guide.md` §6).
3. ✅ `app.config.js` keeps `aps-environment` on the paid team and strips Firebase on iOS — **leave it in place** (the old "delete it" advice is obsolete; see §4a).
4. ✅ Backend dev knows that a new `POST /api/v1/call-service/device-tokens` + a VoIP-push trigger on inbound SIP is required (§6).

If any of those is missing, stop and finish that piece first.

---

## 2. Create the VoIP Services certificate (15 min)

VoIP push uses a separate certificate from the APNs auth key. You will create it once per Bundle ID.

### 2a. Generate a Certificate Signing Request (CSR) on your Mac

1. Open **Keychain Access** (Cmd+Space → "Keychain Access").
2. Menu bar → **Keychain Access** → **Certificate Assistant** → **Request a Certificate From a Certificate Authority…**
3. Fill in:
   - **User Email Address**: the email on your Apple Developer account.
   - **Common Name**: `RHK VoIP CSR` (any label).
   - **CA Email Address**: leave blank.
   - **Request is**: select **Saved to disk**.
4. Click **Continue**, save as `RHKVoIP.certSigningRequest` somewhere you can find it.

### 2b. Create the VoIP cert on the Apple Developer site

1. Go to **https://developer.apple.com/account/resources/certificates/list**.
2. Click the **+** button to add a new certificate.
3. Under **Services**, pick **VoIP Services Certificate**. (Note: NOT "Apple Push Notification service SSL".)
4. Click **Continue**.
5. **App ID**: pick `com.rhkproperties.mobile`.
6. **Upload CSR**: pick the `.certSigningRequest` file from 2a.
7. Click **Continue** → certificate is generated. Click **Download**.
8. Double-click the downloaded `.cer` file → it imports into Keychain Access.

### 2c. Export the cert as `.p12`

The backend will need this in a usable format.

1. In **Keychain Access**, find the new certificate (Common Name will look like "VoIP Services: com.rhkproperties.mobile"). Make sure the private key is nested under it (expand the arrow). If the key is missing, you used the wrong CSR — regenerate from a Mac that has the matching private key.
2. Right-click the certificate → **Export "VoIP Services: com.rhkproperties.mobile"…**
3. Format: **Personal Information Exchange (.p12)**.
4. Save as `rhk-voip.p12`.
5. Set a password — write it down; backend will need it.

> ⚠️ **Treat the `.p12` like a password.** Anyone with it can ring every user's phone. Do NOT commit to git, do NOT send over Slack. Hand it to backend via a password manager.

✅ **Done when** you have a `rhk-voip.p12` file plus its password, stored safely.

---

## 3. Enable the Push Notifications capability on the App ID (2 min)

For the VoIP cert to be honored, the App ID must have the Push Notifications capability turned on.

1. Go to **https://developer.apple.com/account/resources/identifiers/list**.
2. Click `com.rhkproperties.mobile`.
3. Scroll to **Capabilities** → **Push Notifications** → must be **checked**. (It probably already is if regular push works.)
4. Click **Save** if you changed anything.

---

## 4. Un-strip `aps-environment` and add VoIP background mode (5 min)

The current `app.config.js` removes the push entitlement so a free Apple team can sign. Once you're on a paid team (which you are by now — regular push works), that hack must go.

### 4a. ~~Delete the stripping plugin~~ (OBSOLETE — do not do this)

> **Outdated.** This step was written when `app.config.js` only stripped
> `aps-environment`. It now ALSO strips the Firebase config plugins on iOS (the
> RNFirebase pods don't compile under RN 0.81 + `use_frameworks: static`). Deleting
> it would re-break the iOS build. **Leave `app.config.js` in place.** The
> `aps-environment` entitlement is already kept (the paid team supports push), and
> `withIosVoip` is intentionally NOT in the iOS drop-set so it runs on iOS.

### 4b. Add the `voip` background mode

Open [`app.json`](../app.json), find `ios.infoPlist.UIBackgroundModes` (currently `["audio"]`), and add `"voip"`:

```jsonc
"ios": {
  "infoPlist": {
    "LSApplicationQueriesSchemes": ["otpauth"],
    "UIBackgroundModes": ["audio", "voip"]
  }
}
```

> `voip` is what tells iOS this app receives PushKit pushes. Without it the PushKit token registration silently fails on a real build.

✅ **Done when** `app.config.js` is gone and `app.json` lists `"voip"` under `UIBackgroundModes`.

---

## 5. Install `react-native-callkeep` and wire CallKit (20 min)

CallKit is what draws the native incoming-call UI. `react-native-callkeep` is the JS bridge.

### 5a. Install the library

```bash
cd boh-mobile
pnpm add react-native-callkeep
pnpm add -D <expo-config-plugin-for-callkeep>   # see step 5b — confirm the package name
```

> ⚠️ **react-native-callkeep does NOT have a first-party Expo config plugin.** You need a community plugin (search npm for "expo-config-plugin-react-native-callkeep" or "@config-plugins/react-native-callkeep") OR write a tiny inline plugin. If unsure, ask in #engineering before installing — picking a stale fork wastes hours.

### 5b. Register the plugin in `app.json`

Add to the `plugins` array in [`app.json`](../app.json):

```jsonc
[
  "<callkeep-plugin-package>",
  {
    "ios": {
      "displayName": "RHK Properties",
      "supportsVideo": false,
      "maximumCallsPerCallGroup": 1,
      "maximumCallGroups": 1,
      "includesCallsInRecents": true,
      "ringtoneSound": "default",
    },
  },
]
```

These values become `Info.plist` entries (`CXProviderConfiguration`).

### 5c. Add the PushKit handler shim (native side)

Most callkeep Expo plugins inject the necessary `AppDelegate` code automatically. Verify after prebuild that `ios/<project>/AppDelegate.swift` (or `.mm`) contains:

```swift
import PushKit

// In application didFinishLaunching:
let registry = PKPushRegistry(queue: nil)
registry.delegate = self
registry.desiredPushTypes = [.voIP]

// Plus delegate methods:
func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) { ... }
func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) { ... }
```

If the plugin does NOT inject this, you must do it manually (search "react-native-voip-push-notification" or the callkeep docs). The `didReceiveIncomingPushWith` MUST call `CXProvider.reportNewIncomingCall(...)` synchronously before its completion handler runs, or iOS will kill the app and disable VoIP push for it.

### 5d. Add the PushKit token registration path (JS side)

Create `src/features/callService/hooks/use-register-voip-token.ts` (mirrors `src/features/notifications/hooks/use-register-push-token.ts`):

```ts
// Pseudocode — adapt to your codebase
import VoipPushNotification from 'react-native-voip-push-notification'; // or callkeep's exported event
import { apiClient } from '@/lib/api';

export function useRegisterVoipToken(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    VoipPushNotification.addEventListener('register', (token) => {
      apiClient.post('/api/v1/call-service/device-tokens', {
        platform: 'ios',
        kind: 'voip',
        token,
      });
    });
    VoipPushNotification.registerVoipToken();
  }, [userId]);
}
```

Wire it into `CallProvider`. The brain already exposes `answerCall`/`hangup`/etc; CallKit events should call those via the controller singleton — do NOT fork SIP logic.

---

## 6. Backend — what must exist (does NOT exist yet)

Mobile cannot test §7 until backend ships these two pieces. Flag this with backend the moment you start §5.

### 6a. Device-token endpoint

`POST /api/v1/call-service/device-tokens` — same shape as the notifications device-token endpoint, but stores the VoIP token separately from the regular APNs token. The token from §5d is what the body carries.

### 6b. VoIP-push trigger on inbound SIP

When FreeSWITCH detects an inbound call for an agent who is offline or backgrounded, backend must:

1. Look up the agent's VoIP token.
2. Send a PushKit push to APNs (host `api.push.apple.com`, topic `com.rhkproperties.mobile.voip`) using the `rhk-voip.p12` from §2c. Apple's `node-apn` or the official `apns2` library both support VoIP pushes — set `pushType: 'voip'`.
3. The payload must contain the caller identity + a call handle so the woken app can call `RNCallKeep.displayIncomingCall(...)`.
4. **Park or ring-timeout** the call in FreeSWITCH long enough for the woken app to register SIP and accept (15–20 sec is typical).

> ⚠️ **Expo Push does NOT support VoIP/PushKit.** You cannot reuse the regular push pipeline. Backend must talk to APNs directly with the `.p12`.

---

## 7. Build and run (15 min first time, plus app-store TestFlight if needed)

VoIP push works on **dev builds** signed against a paid team. Steps:

```bash
cd boh-mobile
pnpm install
expo prebuild --clean              # regenerates ios/ with the new entitlements
expo run:ios --device              # picks your physical iPhone
```

After install, on first launch:

1. App requests microphone permission → **Allow**.
2. App requests notifications permission → **Allow** (CallKit incoming UI uses it on lock screen).
3. Lock the phone. Have a colleague (or another SIP extension you control) call your extension. Within 1–2 seconds the **native iOS incoming-call screen** must appear on the lock screen, with the caller name.
4. Tap **Accept**. The brain's `answerCall` should fire via the controller singleton and audio should flow.
5. Tap the red **End** button. The brain's `hangup` should fire and the SIP session should terminate cleanly.

✅ **Done when** locked-screen incoming + accept + end all route through CallKit and the existing brain.

---

## 8. If something doesn't work

| Symptom                                                         | Likely cause                                                                    | Fix                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VoIP token never registers (no log line in §5d)                 | `voip` missing from `UIBackgroundModes`, or no VoIP cert provisioned            | Redo §4b and confirm cert in §2 was generated against `com.rhkproperties.mobile`                                                                       |
| Build fails: "Provisioning profile doesn't include push"        | Push capability off on App ID                                                   | Redo §3                                                                                                                                                |
| Build fails: "aps-environment entitlement"                      | `app.config.js` still strips it, or Apple team is still free                    | Confirm §4a (file deleted) AND Apple Developer membership is **paid + active**                                                                         |
| App crashes the moment a VoIP push arrives                      | `didReceiveIncomingPushWith` did NOT call `reportNewIncomingCall` synchronously | Read §5c again — Apple kills any app that swallows a VoIP push without reporting a call. Repeat 3 times and Apple blacklists the bundle from VoIP push |
| CallKit shows incoming UI but Accept does nothing               | CallKeep `answerCall` event not wired to the controller singleton               | In `CallProvider`, subscribe to `RNCallKeep.addEventListener('answerCall', …)` → `getCallController().answerCall(...)`                                 |
| Push works once, then stops after killing the app several times | Apple's VoIP throttling — you sent a VoIP push without showing a call UI        | Hard-rule: **every** VoIP push must result in `reportNewIncomingCall`. Including in dev.                                                               |
| Lock-screen UI appears but audio is one-way                     | InCallManager not started, or ICE failing                                       | Confirm `startCallAudio()` runs in the accept path; check STUN from `credentials.stun_server`                                                          |

---

## Quick reference — what value goes where

| Value                      | Where to get it                                                   | Where it goes                                                 |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| `rhk-voip.p12` + password  | §2c (Apple Developer → VoIP Services Cert → export from Keychain) | backend `.env` / secrets manager — used by APNs HTTP/2 client |
| `voip` background mode     | §4b                                                               | `app.json` → `ios.infoPlist.UIBackgroundModes`                |
| CallKeep plugin config     | §5b                                                               | `app.json` → `plugins`                                        |
| PushKit token (per device) | §5d (`VoipPushNotification` event)                                | backend `POST /api/v1/call-service/device-tokens`             |
| APNs topic                 | constant `com.rhkproperties.mobile.voip`                          | backend APNs request header                                   |

Once §1–§7 are done and backend (§6) has shipped, **the foreground brain handles the rest** — CallKeep events bridge into the existing controller singleton, no SIP logic is duplicated.

---

## Next step

Android setup is its own guide → [`calling-native-setup-android.md`](./calling-native-setup-android.md).
