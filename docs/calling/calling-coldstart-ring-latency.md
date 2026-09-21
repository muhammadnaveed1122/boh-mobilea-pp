# Cold-start ring latency (killed app) — problem & planned fix

Status: **planned, not implemented.** Captured for later.

## Problem (concise)

When the app is **fully killed** and a call arrives, the incoming-ring UI takes noticeably long to appear.

Why: today the ring is triggered from **JavaScript**. On a killed app the whole React Native JS runtime must boot before the ring can show:

```
FCM data push → RNFirebase headless JS task → boot RN runtime + JS bundle
             → JS setBackgroundMessageHandler → calls native module .show() → ring UI
```

The slow step is "boot RN runtime + JS bundle" (the `Android Bundled … index.js` log line). The ring waits on it.

Two contributing factors:

1. **Dev build skews the measurement.** In dev, JS is bundled over the network from Metro each launch (the "Bundled" line) and isn't precompiled — far slower than release. A **release APK** precompiles JS to Hermes bytecode, so cold JS boot is dramatically faster. Much of the observed delay is dev-mode only.
2. **Architectural ceiling.** Even in release, the ring waits for JS boot, because JS issues the "show the ring" command.

Confirmed NOT the cause: backend already sends FCM `priority: high`, data-only.

## Current architecture (for reference)

- Killed-app wake handled by RNFirebase `setBackgroundMessageHandler` (headless JS):
  [src/features/callService/services/fcm-call-messaging.ts](../../src/features/callService/services/fcm-call-messaging.ts)
- Ring UI (CallStyle notification + full-screen + looping ringtone) is a **native Kotlin** Expo module, called from JS:
  [modules/incoming-call/android/src/main/java/expo/modules/incomingcall/IncomingCallModule.kt](../../modules/incoming-call/android/src/main/java/expo/modules/incomingcall/IncomingCallModule.kt)
- The FCM data push is only a **wake signal**; the real call arrives as a SIP `INVITE` over the websocket once the app boots.

## Planned fix (do later)

### Step 0 — measure first (cheap, do before any native work)

- Test on a **release build**, not dev. Re-judge the delay; it may already be acceptable.
- Add timing logs around the FCM→ring path: stamp time when the headless handler starts and when `showIncomingCallNotification` resolves. Log the delta. Decide if the heavy fix below is even needed.

### Step 1 — the real fix: show the ring from native, before JS (only if Step 0 says it's needed)

Move the ring trigger out of JS. Add a native Kotlin **`FirebaseMessagingService`** that, on receiving a `voip_incoming` data message, calls the existing notification-display code **directly — without booting RN/JS**. JS still boots in parallel to handle the SIP `INVITE` + audio.

Result: ring shows in ~tens of ms (native), independent of JS boot time.

This is "wire the existing `IncomingCallModule` notification code to a native FCM service" — not new UI.

**Known gotcha:** Expo and RNFirebase each register an FCM service; there is a service-priority conflict (Expo vs RNFirebase, priority -1 vs 0). The custom `FirebaseMessagingService` must out-prioritize so it receives the message. Solved before in this project — see memory note `callkeep-android-coldstart`.

**Plan of work for Step 1:**

1. Add a `FirebaseMessagingService` (Kotlin) in the `incoming-call` module (or a sibling module).
2. In `onMessageReceived`, detect `type == "voip_incoming"` and call the same code path `IncomingCallModule.show()` uses (post the CallStyle notification + full-screen intent + ringtone).
3. Handle `voip_cancel` natively too (dismiss by uuid) so a cold-start cancel is instant.
4. Register the service in `AndroidManifest` with priority high enough to win over Expo/RNFirebase's default handler.
5. Keep the JS `setBackgroundMessageHandler` for the non-ring work (seeding store, SIP) — or guard against double-show (dedupe by uuid).
6. Verify: killed-app call rings before the JS "Bundled" log appears.

### Smaller levers (help JS boot, won't beat Step 1)

- Trim top-level/module-eval work pulled in by `index.js` / `app/_layout.tsx` (headless task evaluates the whole imported module graph).
- Hermes + New Arch already enabled.

## Honest expectation

- Release build + confirmed high-priority push may make it good enough → Step 1 not needed.
- If still laggy in release, **only** the native service (Step 1) removes the JS-boot tax. JS-side tweaks alone will not make a killed-app ring feel instant.
