# Calling — Implementation Knowledge (for AI agents / developers)

Technical onboarding for anyone (human or AI) extending the in-app calling
feature in `boh-mobile`. Read this before touching `src/features/callService`.
Pairs with `calling-setup-guide.md` (operator steps) — this file is the
**architecture + what's left**.

---

## 1. Locked decisions (do not relitigate)

| Decision       | Value                                     | Why                                                                                                                                        |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Scope          | **Foreground-only**                       | Background/locked-screen incoming needs VoIP push → blocked on paid Apple + Firebase (same blocker as paused push notifications).          |
| SIP/WebRTC lib | `sip.js@0.21.2` + `react-native-webrtc`   | sip.js pinned to the **exact** web version (`boh-lead-magnet`) so the SIP state machine is portable 1:1. Do not bump independently of web. |
| Audio          | `react-native-incall-manager`             | Replaces web `<audio>` elements: audio session, earpiece/speaker, proximity, ring/ringback.                                                |
| State          | **Zustand** (`useCallStore`)              | Mirrors the web Redux `callServiceSlice` shape exactly. Not RTK — mobile has no Redux.                                                     |
| Dialer         | Call-from-lead **and** standalone dialpad | Parity with web.                                                                                                                           |
| Backend        | **No change**                             | Backend already returns `user.callingExtension`; clients dial FreeSWITCH directly (backend never originates).                              |

This is a **port** of `boh-lead-magnet/src/features/callService/hooks/useCallServiceManager.ts`
(~1700 lines, the "brain"). When in doubt, diff against web.

---

## 2. Architecture & data flow

```
auth/signin|profile ──► user.callingExtension.credentials (snake_case)
                              │
            services/sip-config.ts  getSipConfigForUser() → SipConfig | null
                              │
app/_layout.tsx ──► webrtc-bootstrap (registerGlobals FIRST)
                  └─► <CallProvider/>  (mounted once, non-visual + overlays)
                              │
                  hooks/use-call-service.ts  (THE BRAIN: sip.js UserAgent,
                  Registerer, Inviter/Invitation, lifecycle, timers)
                       │                         │
              store/call.store.ts (Zustand)   services/call-controller.ts
              (UI state, mirrors web slice)   (imperative singleton =
                       │                       RN analogue of window.*)
        ┌──────────────┼───────────────┐               │
   IncomingCallScreen ActiveCallScreen CallOutcomeModal │
   (overlays rendered by CallProvider) MicPermissionDialog
                                                        │
                              LeadCard / HeroHeaderCard / DialpadScreen
                              call getCallController().makeCall(...)
```

Key substrate swaps from web → mobile:

| Web                                          | Mobile                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Browser `RTCPeerConnection`/`getUserMedia`   | `react-native-webrtc` via `registerGlobals()` (sip.js default Web SDH runs unmodified — **Route A**) |
| `<audio>` remote + ringtone/ringback         | `services/call-audio.ts` → `react-native-incall-manager`                                             |
| `navigator.permissions`                      | `hooks/use-call-permissions.ts` (Android `PermissionsAndroid`; iOS = getUserMedia prompt)            |
| Redux slice + selectors                      | `store/call.store.ts` (Zustand)                                                                      |
| `window.makeGlobalCall` / `openGlobalDialer` | `services/call-controller.ts` singleton, registered by `CallProvider`                                |
| Floating draggable widget + `CallModal`      | Full-screen RN `Modal` overlays in `CallProvider` + `/(app)/call/dialpad` route                      |
| `beforeunload`/`pagehide` guards             | `AppState` listener in the brain                                                                     |

---

## 3. File map

| Path                                                                                                                                    | Role                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `services/webrtc-bootstrap.ts`                                                                                                          | Side-effect: `registerGlobals()`. **First import** in `app/_layout.tsx`. Must run before any `UserAgent`.                                                    |
| `services/rn-sdh.ts`                                                                                                                    | `ensureWebRTCRegistered()` (idempotent), `assertWebRTCGlobals()` dev check, re-exports `holdModifier`. **Route B (custom SDH) goes here** if Route A breaks. |
| `services/sip-config.ts`                                                                                                                | Pure `getSipConfigForUser` / `hasCallingExtensionForUser` / `getAgentExtension` / `validateSipConfig`.                                                       |
| `services/call-audio.ts`                                                                                                                | InCallManager wrapper. Every fn is best-effort (never throws). `stopCallAudio()` MUST run in every terminal path.                                            |
| `services/callService.api.ts`                                                                                                           | `connectLead` / `skipLead` (speed-to-lead DTMF 1/2). Uses shared axios `apiClient`, prefixes `/api/v1`.                                                      |
| `services/call-controller.ts`                                                                                                           | Imperative singleton. All methods `=> void` (fire-and-forget); `CallProvider` wraps the async brain handlers with `.catch`.                                  |
| `store/call.store.ts`                                                                                                                   | Zustand state = web slice shape. `isActiveCall()`, `selectLiveNotes()` helpers. Reset wired into `src/lib/session.ts` `resetSessionData()`.                  |
| `hooks/use-call-service.ts`                                                                                                             | THE BRAIN. Owns sip.js refs + lifecycle. Returns state + imperative API.                                                                                     |
| `hooks/use-sip-config.ts`                                                                                                               | `useSipConfig()`, `useHasCallingExtension()` (gates call UI).                                                                                                |
| `hooks/use-call-permissions.ts`                                                                                                         | Mic permission → `{granted,denied,prompt}` (shape the brain expects).                                                                                        |
| `components/CallProvider.tsx`                                                                                                           | Mounts brain, registers controller, renders overlays. Mounted in `app/_layout.tsx` after `<InAppBannerHost/>`.                                               |
| `components/IncomingCallScreen.tsx` / `ActiveCallScreen.tsx` / `DialpadScreen.tsx` / `CallOutcomeModal.tsx` / `MicPermissionDialog.tsx` | UI.                                                                                                                                                          |
| `app/(app)/call/dialpad.tsx`                                                                                                            | Route; gates on `useHasCallingExtension()`; registered in `app/(app)/_layout.tsx` as a modal.                                                                |

Edits outside the feature: `src/types/auth.types.ts` (`UserCallingExtension`),
`src/features/leads/models/lead-detail.ts` (`CallLogPayload` + `UpdateLeadPayload.callLog`),
`src/features/leads/components/LeadCard.tsx` & `lead-detail/HeroHeaderCard.tsx`
(Phone button → `getCallController().makeCall`), `src/lib/session.ts`,
`app/_layout.tsx`, `app.json`.

---

## 4. Critical invariants (break these and calls fail)

1. **`registerGlobals()` before sip.js use.** Guaranteed by the first import in
   `app/_layout.tsx`; the brain also calls `ensureWebRTCRegistered()` before
   constructing `UserAgent`. Never construct a `UserAgent` without it.
2. **Single brain instance.** `useCallService()` owns `useRef`s for the
   `UserAgent`/session. Call it **only** in `CallProvider`. Everything else
   uses the controller singleton or the store.
3. **`stopCallAudio()` in every terminal path** (Terminated listener, hangup
   `finally`, error path). Otherwise the iOS audio session leaks and other app
   audio breaks.
4. **Outcome modal de-dupe.** Both the `Terminated` listener and hangup's
   already-terminated branch call `triggerOutcomeModal()`. The `isHangingUpRef`
   - state guards prevent a double PATCH. Keep them.
5. **DTMF on SIP INFO**, not RFC2833. `session.info(...)` is transport-level
   and reliable on RN; the `RTCDTMFSender` path is intentionally omitted.
6. **Lint:** `void` operator is banned (`sonarjs/void-use`). Fire-and-forget =
   `.catch(() => {})`, or wrap so the call site stays `=> void`.

---

## 5. Verification (no test runner; user rejects TDD)

- `node_modules/.bin/tsc --noEmit` → 0 errors.
- `node_modules/.bin/eslint .` → 0 errors (3 pre-existing warnings in
  `eslint.config.js` / `theme/tokens.ts` are not ours).
- `node_modules/.bin/prettier --check ...` → clean.
- Build only works as a **custom dev build** (`expo prebuild --clean` +
  `expo run:*`); native modules are absent from Expo Go.
- Manual E2E: see `calling-setup-guide.md` §6 (two SIP extensions).

---

## 6. What is LEFT — native ringer & background / lock-screen calling

This is the deferred phase. It is **blocked on credentials**, not code design.

### 6.1 Why it's not done

Receiving a call when the app is backgrounded or the device is locked requires
the OS to wake the app _before_ a SIP socket can exist:

- **iOS:** VoIP push via **PushKit** + **CallKit**. PushKit needs a VoIP push
  certificate, which needs a **paid Apple Developer account** ($99/yr) and the
  Push Notifications capability on the App ID `com.rhkproperties.mobile`.
  `app.config.js` currently _strips_ the `aps-environment` entitlement so the
  personal/free team can sign — that strip must be removed and a real APNs/VoIP
  cert provisioned.
- **Android:** a high-priority **FCM data message** wakes the app →
  `ConnectionService`. FCM needs a **Firebase project** + `google-services.json`
  - an FCM service-account key.

These are the _same_ accounts/consoles that block push notifications. See
`notifications-setup-guide.md` §2–§3 — when those are set up, this phase is
unblocked. Until then, foreground-only is the correct, shipped behavior.

### 6.2 Backend work required (does not exist yet)

The current backend only **provisions credentials** and routes speed-to-lead
calls (`/call-service/leads/:id/connect|skip`). For background incoming it must
additionally:

1. Know each agent's **device push token(s)** (iOS VoIP token, Android FCM
   token) — a new endpoint, e.g. `POST /call-service/device-tokens`
   (mirror the notifications `device-tokens` pattern).
2. When FreeSWITCH has an inbound call for an offline/backgrounded agent, send
   a **VoIP/data push** (Expo Push does NOT support VoIP/PushKit — likely
   direct APNs VoIP + FCM, or a provider) carrying caller id + a call handle,
   _then_ let the woken app register SIP and accept.
3. Handle the **race**: push delivered → app cold-starts → SIP registers →
   FreeSWITCH must still have the call ringing (ring timeout / park).

None of this exists. Treat 6.2 as a backend design task, not a mobile tweak.

### 6.3 Mobile work required (when unblocked)

Add (do NOT add now — it is dead weight without 6.1/6.2):

- `react-native-callkeep` — native call UI (CallKit/ConnectionService). Needs a
  config plugin + `expo prebuild`.
- iOS: `expo-notifications` re-enabled (delete/relax `app.config.js`), VoIP
  push entitlement, a PushKit token registration path.
- Android: FCM (`google-services.json`), a high-priority data-message handler
  that calls CallKeep `displayIncomingCall` and brings up the SIP stack, plus
  a **foreground service** (`FOREGROUND_SERVICE_MICROPHONE`) so mic capture
  survives backgrounding mid-call.
- A push-token → backend registration hook (parallel to
  `src/features/notifications/hooks/use-register-push-token.ts`).
- Bridge CallKeep events (`answerCall`, `endCall`, audio session) to the
  existing brain handlers. The brain's imperative API (`answerCall`, `hangup`,
  `toggleMute`, …) is already the right seam — CallKeep events should call into
  the controller singleton, not duplicate SIP logic.
- Remove/relax the `AppState`-suspends-socket assumption only for the
  push-woken path; foreground behavior stays as-is.

### 6.4 Suggested phasing for the next agent

1. Backend: device-token endpoint + VoIP/FCM push on inbound (6.2). Blocked on
   Apple paid acct + Firebase.
2. Mobile iOS: PushKit + CallKeep + entitlement un-strip.
3. Mobile Android: FCM data message + CallKeep + foreground service.
4. Reuse the existing brain via the controller singleton — do not fork the SIP
   state machine.

Until step 1's credentials exist, **do not** add `react-native-callkeep` or
re-enable push — it only adds native build complexity with zero functional
gain, and would risk re-introducing the `aps-environment` signing problem that
`app.config.js` works around.

---

## 7. Known risks / gotchas

- **Route A SDH**: sip.js's default Web SDH runs on `react-native-webrtc`
  globals. If a future RN-WebRTC release lacks a browser API the SDH needs,
  implement a custom `SessionDescriptionHandlerFactory` in `services/rn-sdh.ts`
  (Route B) and pass it to `UserAgent` — the brain isolates all SIP
  construction so only that file changes.
- **WSS/TLS**: RN rejects self-signed certs Chrome tolerates. If SIP never
  registers against a working web setup, suspect the FreeSWITCH cert (infra,
  not app).
- **No remote-audio attach**: unlike web (`bindRemoteAudio` → `<audio>`), RN
  relies on `react-native-webrtc` auto-playing the remote track through the
  InCallManager-managed audio session. If audio is one-way, check
  `startCallAudio()` ran and ICE/STUN from `credentials.stun_server`.
- **pnpm hoisted**: native autolinking depends on `nodeLinker: hoisted` in
  `pnpm-workspace.yaml`. Don't change it. `pnpm-lock.yaml` is authoritative.
- **Backgrounding drops calls** — by design (§6.1). Don't "fix" it without the
  full push/CallKeep stack.
