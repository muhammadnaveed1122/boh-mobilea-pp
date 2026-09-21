# Native Calling Setup — Android (Beginner Guide)

This guide takes you from "the foreground-only calling feature works" to "incoming SIP calls ring the phone with the native Android incoming-call UI even when the app is closed or the screen is locked." Written for someone who has **never set up high-priority FCM data messages or ConnectionService before**. Follow it top to bottom — don't skip steps.

> **Why this is needed:** sip.js only connects while the app is in the foreground. To ring the phone when the app is killed or the screen is locked, Android needs a **high-priority FCM data message** to wake the app — then the app uses **ConnectionService** (Android's CallKit equivalent) to draw the full-screen incoming-call UI and keeps the mic alive via a **foreground service**.
>
> Read the architecture context first: [`calling-implementation-guide.md`](./calling-implementation-guide.md) §6. The iOS counterpart is [`calling-native-setup-ios.md`](./calling-native-setup-ios.md). The regular-push Android guide [`notifications-setup-android.md`](./notifications-setup-android.md) is a prerequisite — do that first.

---

## 0. Before you start — what you need

| You need                                                 | Why                                                                             | Cost | Where                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| Everything from `notifications-setup-android.md` §0      | Same Android Studio / FCM project / Expo project ID                             | Free | See that guide                                                                       |
| Regular Android push notifications already working       | Calling reuses the same Firebase project + service-account key                  | —    | Confirm a normal notification arrives before touching this guide                     |
| A **real Android phone** with Play Services (Android 9+) | ConnectionService is unreliable on emulators; Play Services is required for FCM | —    | A normal Pixel works; CallKit-style UI quality varies by OEM (Samsung/Xiaomi differ) |
| Backend with a **VoIP push endpoint**                    | The phone-side work is useless until the server can push                        | —    | Currently **does not exist** — see §6 for what backend must build                    |

### Words you'll see

- **FCM data message** = an FCM payload with no `notification` field, only `data`. Wakes the app without showing the default notification card.
- **High-priority FCM** = `priority: "high"` (HTTP v1: `"AndroidConfig": { "priority": "HIGH" }`). Bypasses Doze mode briefly so a killed app can wake fast. Abuse → Google throttles your project.
- **ConnectionService** = Android's native telecom framework. Draws the lock-screen / full-screen incoming-call UI and routes audio to Bluetooth/earpiece/speaker.
- **`react-native-callkeep`** = bridges ConnectionService on Android and CallKit on iOS into a single API.
- **Foreground service** = an Android service with a persistent notification. Required for mic capture to survive backgrounding mid-call (Android 14+ enforces `FOREGROUND_SERVICE_MICROPHONE` permission).
- **`MANAGE_OWN_CALLS`** = the permission that lets a non-phone app use ConnectionService.

### Useful reference docs (open in tabs)

- Android — Build a calling app → <https://developer.android.com/develop/connectivity/telecom/selfManaged>
- FCM HTTP v1 send API → <https://firebase.google.com/docs/cloud-messaging/send-message>
- react-native-callkeep → <https://github.com/react-native-webrtc/react-native-callkeep>
- Android 14 foreground service types → <https://developer.android.com/about/versions/14/changes/fgs-types-required>

---

## 1. Confirm prerequisites are green (5 min)

Do not start this guide until **all four** are true:

1. ✅ Regular Android push notifications arrive on your phone (per `notifications-setup-android.md`).
2. ✅ Foreground SIP calls work between two SIP extensions (per `calling-setup-guide.md` §6).
3. ✅ `google-services.json` exists at `boh-mobile/google-services.json`.
4. ✅ Backend dev knows that a new `POST /api/v1/call-service/device-tokens` + an FCM data-message trigger on inbound SIP is required (§6).

If any of those is missing, stop and finish that piece first.

---

## 2. Firebase — confirm or grab the service-account key (5 min)

Calling reuses the **same Firebase project + service-account key** that regular push uses (per `notifications-setup-android.md` §3). You do **not** need a separate project.

But there's a catch: the regular-push backend (if it uses Expo Push) talks to **Expo's** server, not directly to FCM. Calling **cannot** use Expo Push — Expo doesn't support data-only high-priority messages with the latency calling needs. Backend must call FCM **directly** using the Firebase Admin SDK.

So either:

- Reuse the service-account `.json` from `notifications-setup-android.md` §3 (the one you uploaded with `eas credentials`) → hand the same file to backend.
- If you can't find that file, regenerate it: Firebase Console → ⚙️ → **Project settings** → **Service accounts** → **Generate new private key**. Same flow as the notifications guide. Keep both copies aligned — the Expo upload and the backend copy should be the same key, or backend has its own.

> ⚠️ **The `.json` is a master credential.** Anyone with it can ring every user's phone AND read all your Firebase data. Treat like a password. Store in backend secret manager — never commit.

✅ **Done when** backend has access to a current Firebase service-account `.json` for the `RHK Properties` project.

---

## 3. Add the Android permissions (3 min)

Open [`app.json`](../app.json) and find the `android.permissions` array. Add these (keep the existing ones):

```jsonc
"android": {
  "permissions": [
    "android.permission.RECORD_AUDIO",
    "android.permission.MODIFY_AUDIO_SETTINGS",
    "android.permission.MANAGE_OWN_CALLS",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MICROPHONE",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.WAKE_LOCK",
    "android.permission.USE_FULL_SCREEN_INTENT"
  ]
}
```

What each does:

- `MANAGE_OWN_CALLS` — required to use ConnectionService as a non-phone app. Granted at install time (no runtime prompt).
- `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MICROPHONE` — required on Android 14+ for the mid-call service.
- `POST_NOTIFICATIONS` — runtime permission for the persistent foreground-service notification.
- `WAKE_LOCK` — keeps CPU awake briefly while waking from doze.
- `USE_FULL_SCREEN_INTENT` — lets the incoming-call UI take over the lock screen. Android 14+ asks the user to grant this in Settings → Apps → Special access; some launchers auto-grant for "Phone & Default" apps but Self-Managed calls don't qualify, so the user **will** see a permission flow.

---

## 4. Install `react-native-callkeep` and wire ConnectionService (20 min)

CallKeep abstracts ConnectionService into the same JS API used by CallKit on iOS.

> ### ✅ Implementation note — this section is DONE, and it differs from the original plan below
>
> §4 shipped (`@react-native-firebase/app` + `/messaging` + `react-native-callkeep`,
> the config plugin, and all JS). **Two design corrections were forced by how the
> libraries actually behave** — the earlier pseudocode in this section was wrong on
> both counts. Read these before changing anything:
>
> **Correction 1 — NO native Kotlin FCM service. Use a JS headless handler instead.**
> The original 4c proposed a `CallingFcmService.kt` that calls
> `RNCallKeepModule.displayIncomingCall(...)` directly from Kotlin. **That cannot work
> when the app is cold-killed.** callkeep's `displayIncomingCall` is an _instance_
> method that no-ops until JS has run `RNCallKeep.setup()` (see
> `RNCallKeepModule.java` ~L449: "ignored due to no ConnectionService or no phone
> account"). On a cold start the instance is `null`, so nothing rings. The working
> pattern is `@react-native-firebase/messaging`'s `setBackgroundMessageHandler` — a
> **headless JS task that boots even when the app is killed** — which calls
> `RNCallKeep.setup()` then `displayIncomingCall`. This also deletes the
> service-coexistence problem: no second `FirebaseMessagingService` to register.
>
> **Correction 2 — the call controller is no-arg single-call, not UUID-based.**
> The original 4e pseudocode called `controller.answerCall(callUUID)` /
> `controller.hangup(callUUID)` / `controller.setMute(callUUID, muted)`. The real
> `CallController` (`services/call-controller.ts`) tracks ONE call and takes NO
> UUID: `answerCall()`, `hangup()`, `toggleMute()`. A small coordinator singleton
> (`services/callkeep-coordinator.ts`) bridges callkeep's per-UUID events to it.
>
> **Files that shipped** (all under `src/features/callService/`, plus the plugin):
>
> - `plugins/withCallKeep.js` — inline config plugin, injects `VoiceConnectionService`.
> - `services/callkeep.ts` — `setupCallKeep()` + display/connect/end wrappers (the only file that imports RNCallKeep, besides the bridge).
> - `services/callkeep-coordinator.ts` — dependency-free state singleton (current UUID, callKeep-driven flag, pending-answer).
> - `services/fcm-call-messaging.ts` — `registerCallBackgroundHandler()` → `setBackgroundMessageHandler` → `displayCallKeepIncoming`.
> - `hooks/use-callkeep-bridge.ts` — maps callkeep events to the controller; rehydrates via `getInitialEvents()`.
> - `hooks/use-register-fcm-call-token.ts` + `services/callService.api.ts#registerCallDeviceToken`.
> - Brain guards in `hooks/use-call-service.ts` (`onInvite`); wiring in `components/CallProvider.tsx`; bg-handler registered at `app/_layout.tsx` module scope.

### 4a. Install the libraries

```bash
cd boh-mobile
npx expo install @react-native-firebase/app @react-native-firebase/messaging react-native-callkeep
```

`@react-native-firebase` provides both the FCM token (`messaging().getToken()`) and the
headless background handler. Calling **cannot** use Expo Push, so RNFirebase talks to FCM
directly (see §2).

> ⚠️ There is **no first-party Expo plugin for callkeep**. We wrote an inline one
> (`plugins/withCallKeep.js`) rather than trust a community plugin — it owns exactly
> the one manifest entry we need and survives New-Arch/SDK bumps.
>
> ⚠️ **FCM delivery priority gotcha.** Android delivers each push to ONE messaging
> service, by manifest priority. `expo-notifications` registers its service at
> `priority="-1"`; `@react-native-firebase` at the default `0` → **RNFirebase wins
> delivery once installed.** This may affect existing Expo Push notifications — must
> be validated on-device.

### 4b. Register the plugins (`app.json`)

The inline plugin runs on every `prebuild`, so the manifest entry survives `--clean`:

```jsonc
"plugins": [
  // ...existing...
  "@react-native-firebase/app",
  "@react-native-firebase/messaging",
  "./plugins/withCallKeep"
]
```

`plugins/withCallKeep.js` injects **one** `<service>` (callkeep does NOT ship it):

```xml
<service
  android:name="io.wazo.callkeep.VoiceConnectionService"
  android:label="RHK Properties"
  android:permission="android.permission.BIND_TELECOM_CONNECTION_SERVICE"
  android:foregroundServiceType="microphone"
  android:exported="true">
  <intent-filter>
    <action android:name="android.telecom.ConnectionService" />
  </intent-filter>
</service>
```

There is **no `CallingFcmService`** — RNFirebase already registers its own messaging
service, and the headless handler (4c) does the ringing. Verify the injection
non-destructively with `npx expo config --type introspect | grep VoiceConnectionService`.

### 4c. The FCM background handler that rings the call (JS, not Kotlin)

`services/fcm-call-messaging.ts` — runs in the headless task that boots even when killed:

```ts
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { displayCallKeepIncoming } from './callkeep';

async function handleCallMessage(message: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
  const data = message.data ?? {};
  if (data.type !== 'voip_incoming') return; // not a call — leave to normal notifications
  const uuid = typeof data.uuid === 'string' && data.uuid ? data.uuid : fallbackUuid();
  const handle = typeof data.call_handle === 'string' ? data.call_handle : 'unknown';
  const callerName = typeof data.caller_name === 'string' ? data.caller_name : 'Incoming call';
  await displayCallKeepIncoming(uuid, handle, callerName); // setupCallKeep() then displayIncomingCall()
}

export function registerCallBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(handleCallMessage);
}
```

`registerCallBackgroundHandler()` is called at **module scope** in `app/_layout.tsx` so it is
present in BOTH the normal runtime and the killed-app headless runtime.

### 4d. Token registration (JS side)

`hooks/use-register-fcm-call-token.ts` — `messaging().getToken()` + `onTokenRefresh` →
`registerCallDeviceToken(token, platform)` (`POST /api/v1/call-service/device-tokens`,
`kind: 'fcm'`). Deduped on last token, silent-catch on failure. Wired in `CallProvider`
as `useRegisterFcmCallToken(isAuthenticated)`.

### 4e. Bridge CallKeep events to the existing brain

`hooks/use-callkeep-bridge.ts`. CallKeep events are per-UUID; the controller is no-arg, so
the UUID is dropped and the coordinator carries the cross-cutting state:

```ts
// Android-only for now. On a cold start the headless runtime's coordinator state is gone,
// so rehydrate from callkeep's native-side memory first:
const initial = await RNCallKeep.getInitialEvents();
for (const event of initial ?? []) {
  if (event.name === 'RNCallKeepDidDisplayIncomingCall') beginCallKeepIncoming(event.data.callUUID);
  if (event.name === 'RNCallKeepPerformAnswerCallAction') {
    markPendingAnswer();
    getCallController().answerCall();
  }
}

RNCallKeep.addEventListener('answerCall', () => {
  markPendingAnswer(); // replays in the brain's onInvite if the SIP INVITE hasn't arrived
  getCallController().answerCall(); // no-op if no session yet
});
RNCallKeep.addEventListener('endCall', () => {
  getCallController().hangup();
  resetCallKeepCoordinator();
});
RNCallKeep.addEventListener('didPerformSetMutedCallAction', () => getCallController().toggleMute());
RNCallKeep.addEventListener('didToggleHoldCallAction', () => getCallController().toggleHold());
```

The brain (`use-call-service.ts` `onInvite`) reads the coordinator: when `isCallKeepDriven()`
it suppresses the JS incoming modal + ringtone (native UI owns them), replays a
`consumePendingAnswer()`, calls `reportCallKeepConnected(uuid)` on establish, and
`endCallKeepCall()` on terminate. Foreground calls (no callkeep) behave exactly as before.

> **Cold-start race:** the killed-app FCM headless task and the launched app are
> SEPARATE JS runtimes — coordinator state set in the headless task is gone after the
> app boots. callkeep keeps the events natively, which is why the bridge replays
> `getInitialEvents()` on mount.

---

## 5. Backend — what must exist (the ONLY remaining gap)

> **STATUS:** The Android **client** is fully implemented (headless FCM handler,
> CallKeep ConnectionService, foreground CallStyle banner, FCM token registration,
> and the Android 14+ `USE_FULL_SCREEN_INTENT` runtime prompt + settings entry).
> The backend below is the only thing left. The authoritative backend contract
> (iOS + Android) now lives in [`calling-backend-voip-push.md`](./calling-backend-voip-push.md);
> this section is the Android-specific summary.

Mobile cannot test killed/background incoming until backend ships these two pieces.
Foreground incoming already works today (SIP over WebSocket, no push needed).

### 5a. Device-token endpoint

`POST /api/v1/call-service/device-tokens` — same shape as the notifications device-token endpoint, but stores the FCM token under a separate `kind` so backend knows to use it for high-priority data pushes (not via Expo).

### 5b. FCM data-message trigger on inbound SIP

When FreeSWITCH detects an inbound call for an agent who is offline or backgrounded, backend must:

1. Look up the agent's FCM token from §5a.
2. Send a **data-only, high-priority** FCM HTTP v1 request using `firebase-admin`:

   ```ts
   await admin.messaging().send({
     token,
     data: {
       type: 'voip_incoming',
       uuid: callUuid,
       caller_name: callerDisplay,
       call_handle: callerNumber,
     },
     android: {
       priority: 'high',
       ttl: 0, // deliver now or drop
     },
   });
   ```

3. **Park or ring-timeout** the call in FreeSWITCH long enough for the woken app to register SIP and accept (15–20 sec is typical).

> ⚠️ **No `notification` field.** If you include one, Android shows a default notification card AND skips the data-only `setBackgroundMessageHandler` (§4c) while the app is killed — meaning the incoming-call UI never appears.
>
> ⚠️ **Don't spam high-priority.** Google throttles projects that abuse it. One per real inbound call.

---

## 6. Build and run (15 min first time)

```bash
cd boh-mobile
pnpm install
expo prebuild --clean              # regenerates android/ with new permissions + manifest entries
expo run:android --device          # picks your physical Android phone
```

After install:

1. App requests microphone permission → **Allow**.
2. App requests notifications permission (Android 13+) → **Allow**.
3. App may prompt for **Full-screen intent permission** → tap through to Settings → **Allow**.
4. Lock the phone (or swipe the app fully closed). Have a colleague (or another SIP extension you control) call your extension. Within 1–3 seconds the **native Android incoming-call screen** must appear, full-screen even on the lock screen.
5. Tap **Answer**. CallKeep's `answerCall` event fires → controller singleton → brain's `answerCall` → audio flows.
6. Tap **End**. CallKeep's `endCall` event fires → controller singleton → brain's `hangup`.

✅ **Done when** locked-screen incoming + answer + end all route through ConnectionService and the existing brain.

---

## 7. If something doesn't work

| Symptom                                                      | Likely cause                                                                                | Fix                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| FCM token never registers (no log in §4d)                    | `google-services.json` missing / wrong package, or `@react-native-firebase` not initialized | Redo `notifications-setup-android.md` §2; check `getApp()` runs                                          |
| Push arrives but no incoming UI                              | The push has a `notification` field, OR callkeep `setup()` hasn't run in the headless task  | Make backend send data-only (§5b); confirm `displayCallKeepIncoming` awaits `setupCallKeep()` (§4c)      |
| Incoming UI appears but Answer does nothing                  | CallKeep `answerCall` not wired to controller                                               | Add the listeners in §4e                                                                                 |
| Incoming UI works first time only, then app starts but no UI | Foreground service permission missing / wrong type                                          | Confirm `FOREGROUND_SERVICE_MICROPHONE` in §3 and `android:foregroundServiceType="microphone"` in §4b    |
| Audio is one-way after answer                                | InCallManager not started; ICE failing                                                      | Confirm `startCallAudio()` runs in the accept path; check STUN from `credentials.stun_server`            |
| Lock-screen UI never shows, only notification tray banner    | `USE_FULL_SCREEN_INTENT` not granted (Android 14+)                                          | Settings → Apps → RHK Properties → Display over other apps + Full-screen intent → enable both            |
| Push delivered late (>5 sec) or not at all when phone idle   | Doze mode, or `priority` not `HIGH`                                                         | Confirm backend sends `android.priority = "HIGH"` and `ttl: 0`                                           |
| Samsung / Xiaomi phone never wakes                           | OEM background restrictions                                                                 | Tell user to disable "Battery optimization" for RHK Properties in OEM settings. Unavoidable on some OEMs |

---

## Quick reference — what value goes where

| Value                              | Where to get it                                                           | Where it goes                                     |
| ---------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| Firebase service-account `.json`   | `notifications-setup-android.md` §3 (Firebase Console → Service accounts) | backend secret store (NOT committed)              |
| Permissions list                   | §3                                                                        | `app.json` → `android.permissions`                |
| ConnectionService manifest entries | §4b                                                                       | `AndroidManifest.xml` (via config plugin)         |
| FCM token (per device)             | §4d (`messaging().getToken()`)                                            | backend `POST /api/v1/call-service/device-tokens` |
| FCM data-message payload           | §5b                                                                       | backend `firebase-admin` send call                |

Once §1–§6 are done and backend (§5) has shipped, **the foreground brain handles the rest** — CallKeep events bridge into the existing controller singleton, no SIP logic is duplicated.

---

## Next step

iOS setup is its own guide → [`calling-native-setup-ios.md`](./calling-native-setup-ios.md).
