# In-App Calling — Full Setup Guide (Beginner Friendly)

This guide takes you from "the code is written" to "an agent can call a lead from the phone." Written for someone who has **never built a custom dev build before**. Follow it top to bottom — don't skip.

> **Why this is needed:** the calling code is finished, but it uses two _native_ modules (`react-native-webrtc`, `react-native-incall-manager`) that are **not in Expo Go**. The app must run as a custom dev build. The SIP credentials themselves need **zero setup** — the backend already hands them to the app at login.

---

## 0. Before you start — what you need

| You need                            | Why                                       | Cost             |
| ----------------------------------- | ----------------------------------------- | ---------------- |
| A Mac with **Xcode** installed      | To build the iOS app                      | Free (App Store) |
| **Android Studio** installed        | To build the Android app                  | Free             |
| A user with a **calling extension** | The backend assigns SIP creds to the user | —                |
| A reachable **FreeSWITCH** (WSS)    | The phone dials it directly over SIP      | —                |
| A real device **or** simulator      | Microphone + WebRTC need a real-ish OS    | —                |

Words you'll see:

- **SIP** = the call signaling protocol. The app speaks SIP over a secure WebSocket (WSS) to FreeSWITCH.
- **WebRTC** = the audio media layer (the actual voice). `react-native-webrtc` provides it.
- **Calling extension** = the per-user SIP account (`username`, `password`, `domain`, `websocket_url`, `stun_server`) the backend returns on `auth/signin` and `auth/profile` as `user.callingExtension`.
- **Prebuild** = turning the Expo project into real `ios/` and `android/` native folders so the native calling modules compile in.
- **Foreground-only** = calling works while the app is open on screen. See section 5.

---

## 1. What is and isn't included (read this first)

**Included (works now):**

- Outbound calls from a lead (the Phone button on the lead card and the lead detail hero), and a standalone manual dialpad (`/(app)/call/dialpad`).
- An in-app full-screen incoming-call screen — **only while the app is open/foregrounded**.
- In-call mute, hold, speaker, DTMF keypad; post-call "Log Call Outcome" written to the lead; speed-to-lead DTMF 1 (connect) / 2 (skip).

**Deferred (NOT included — see section 6):**

- A native OS ringer (iOS CallKit / Android ConnectionService).
- Receiving calls when the app is backgrounded or the screen is locked.

These need iOS VoIP **PushKit** + Android **FCM** data push — the _same_ paid Apple account and Firebase console that currently block push notifications (see `notifications-setup-guide.md`).

✅ Done when you understand calling is foreground-only for now.

---

## 2. Install dependencies (one time)

The packages are already in `package.json`. Install with pnpm (the lockfile is `pnpm-lock.yaml`; **never** regenerate `package-lock.json`):

```bash
cd boh-mobile
pnpm install
```

This pulls in `sip.js`, `react-native-webrtc`, `react-native-incall-manager`, and the dev-only `@config-plugins/react-native-webrtc` (the Expo config plugin that wires the native iOS pod / Android gradle / mic permission).

✅ Done when `pnpm install` finishes with no errors about a blocked build script.

---

## 3. Build and run a custom dev build

Expo Go **cannot** run the calling modules. You must prebuild once.

```bash
cd boh-mobile
pnpm expo prebuild --clean        # regenerates ios/ and android/ with the native modules
pnpm expo run:ios                 # or: pnpm expo run:android
```

- First run is slow (compiling native code). Later runs are fast.
- The first call attempt asks for the **microphone** permission → tap **Allow**.
- The `aps-environment` push entitlement is still stripped by `app.config.js` (push stays paused) — that is expected and does not affect calling.

> **pnpm gotcha:** `pnpm-workspace.yaml` sets `nodeLinker: hoisted` so the native autolinker can find the modules. If you switch off hoisted, the build breaks. Keep it.

✅ Done when the app launches from the dev build (not Expo Go) and you accepted the mic prompt.

---

## 4. SIP credentials — nothing to configure

There is **no env var, key, or console step** for calling. The backend (`boh-lead-magnet-backend`) returns the user's SIP account inside the login/profile response as `user.callingExtension.credentials`. The app reads it automatically and connects directly to FreeSWITCH.

- A user **with** a calling extension: the Phone buttons place real calls.
- A user **without** one: the Phone buttons show a "Calling unavailable — ask an admin to assign an extension" dialog and the dialpad route redirects away. The rest of the app is unaffected.

To give a user calling: an admin assigns them a department/extension on the web app (`/call-service/extensions/assign`). After that the user must **sign in again** so the new `callingExtension` is in their session.

✅ Done when a calling-enabled user reaches SIP **registered** (a failed connection shows an alert).

---

## 5. Foreground-only — what to expect

`react-native-webrtc` keeps the SIP WebSocket alive only while the app is foregrounded.

- App open → outbound + incoming work.
- App backgrounded / phone locked → the OS suspends the app, the socket drops, an in-progress call ends. This is **expected**. On returning to the app it re-registers automatically.
- `UIBackgroundModes: ["audio"]` (set in `app.json`) only smooths a brief app-switch _during_ a live call — it does not keep the app alive when fully backgrounded.

✅ Done when you've confirmed a call drops cleanly on backgrounding and the app re-registers on return.

---

## 6. Test it works (in order)

You need **two SIP extensions** on the test FreeSWITCH (one logged into the app, one to call from / be called by).

1. Log in as a calling-enabled user. Confirm SIP registers (no error alert).
2. Log in as a user **without** an extension → Phone buttons show the "unavailable" dialog; app otherwise normal.
3. **Outbound from a lead:** open Leads → tap the Phone button on a card and on the lead-detail hero → full-screen call screen, ringback, two-way audio on answer.
4. **Outbound from the dialpad:** open `/(app)/call/dialpad`, dial, call connects.
5. **In-app incoming:** from the second extension, call the logged-in user while the app is foregrounded on an unrelated screen (e.g. Chat) → the incoming screen covers it. Answer → audio. Decline → caller hears rejection.
6. **In-call controls:** Mute (remote stops hearing you), Hold/Resume, Speaker toggle, keypad sends DTMF.
7. **Speed-to-lead:** trigger a FreeSWITCH lead call (number `0000000000`, leadId as display name); press **1** → `/call-service/leads/:id/connect`; press **2** → `/skip` (check backend logs).
8. **Post-call outcome:** end a call that connected (duration > 0) on a lead → "Log Call Outcome" modal → pick an outcome → the lead's `callLog` is saved (PATCH `/leads/:id`). A 0-second call saves silently with no modal.
9. **Backgrounding:** during a call, background the app → call ends without a crash; foreground → re-registers.
10. **Logout:** SIP unregisters, call state resets, other app audio still works.

✅ Done when steps 1–10 pass on a real device.

---

## 7. If something doesn't work

| Symptom                                  | Likely cause                                   | Fix                                                                                             |
| ---------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| App crashes on launch / module missing   | Running in Expo Go, or stale native build      | `pnpm expo prebuild --clean` + `expo run:*` (section 3)                                         |
| Phone buttons show "Calling unavailable" | User has no calling extension                  | Admin assigns one; user signs in again (section 4)                                              |
| SIP never registers (error alert)        | FreeSWITCH WSS unreachable, or self-signed TLS | RN rejects untrusted certs Chrome tolerates — needs a valid cert on FreeSWITCH (infra, not app) |
| Call connects but no audio               | Mic permission, or audio session not started   | Check mic granted; confirm `react-native-incall-manager` linked in the prebuild                 |
| Mic permission permanently denied        | User tapped "Don't allow"                      | The in-app dialog → **Open Settings** → enable mic                                              |
| Incoming call never shows                | App backgrounded (expected) or not registered  | Keep app foreground; confirm registered (section 5)                                             |
| Call drops when switching apps           | Expected — foreground-only                     | By design; native ringer is deferred (section 1 / 6)                                            |

---

## Where each value comes from (quick reference)

| Value                   | Where it comes from                                   | Where it goes                        |
| ----------------------- | ----------------------------------------------------- | ------------------------------------ |
| SIP credentials         | Backend `auth/signin` / `auth/profile` response       | `user.callingExtension` (automatic)  |
| WebSocket / STUN server | `credentials.websocket_url` / `stun_server`           | resolved by `services/sip-config.ts` |
| Microphone permission   | iOS prompt (Info.plist string) / Android RECORD_AUDIO | requested on first call              |
| Native calling modules  | `pnpm install` + `expo prebuild`                      | compiled into the dev build          |

Once sections 2–3 are done on a calling-enabled user, **no code or credential changes are needed** — the feature is fully built. The native OS ringer / background incoming remains deferred until the paid Apple Developer account + Firebase console from `notifications-setup-guide.md` are set up.
