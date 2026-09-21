# Incoming-Call VoIP Push — Mobile Integration Guide

 

The backend half is built. This doc tells the **mobile dev** exactly what to implement and how to test it against a locally-running backend (over IP or ngrok).

 

When a call rings an agent's extension, the backend sends a push that wakes the app — **even killed/locked** — so it can register SIP and answer.

 

---

 

## 1. Backend contract (what the app talks to)

 

Base URL = the backend (in testing: `http://<dev-ip>:3001` or your ngrok `https://…`). All paths below are under `/api/v1`.

 

### a) Register / rotate the device's call-wake token

```

POST /api/v1/call-service/device-tokens

Authorization: Bearer <user access token>     # same JWT as the rest of the app

Content-Type: application/json

 

{ "platform": "ios" | "android", "kind": "voip" | "fcm", "token": "<string>" }

```

- **iOS** → `kind: "voip"` (the **PushKit** token).

- **Android** → `kind: "fcm"` (the **FCM** token).

- Call this **on login** and **whenever the token is issued/rotated**.

- Sign-out: `DELETE /api/v1/call-service/device-tokens` with `{ "token": "<string>" }`.

 

### b) Push payload the device receives (exact keys)

```json

{ "type": "voip_incoming" | "voip_cancel", "uuid": "<uuidv4>", "caller_name": "<name>", "call_handle": "<e164 or extension>" }

```

- **`voip_incoming`** → an incoming call. Report it to CallKit (iOS) / CallKeep (Android) immediately.

- **`voip_cancel`** → the caller hung up before you answered. Use the **same `uuid`** to dismiss the ringing UI.

 

**Transport details:**

- **iOS:** APNs **VoIP** push — `apns-push-type: voip`, topic `com.rhkproperties.mobile.voip`, priority 10, body `{ "aps": {}, type, uuid, caller_name, call_handle }`.

- **Android:** FCM **data-only**, `android.priority: "high"`, **no `notification` block** (so the headless background handler fires when the app is killed).

 

---

 

## 2. Mobile implementation checklist

 

### iOS (PushKit + CallKit)

- [ ] Register `PKPushRegistry` for `.voIP`; on `didUpdate pushCredentials`, POST the token with `kind: "voip"`.

- [ ] On `didReceiveIncomingPushWith` → **immediately** `CXProvider.reportNewIncomingCall(with: uuid, …)` (iOS _requires_ a call be reported for every VoIP push, or the app gets killed).

- [ ] On a `voip_cancel` push (same `uuid`) → `provider.reportCall(with: uuid, endedAt: …, reason: .remoteEnded)`.

- [ ] Entitlements: **Background Modes → Voice over IP**, Push Notifications. Bundle id **`com.rhkproperties.mobile`**.

 

### Android (FCM + CallKeep / ConnectionService)

- [ ] Get the FCM token; POST it with `kind: "fcm"`.

- [ ] `setBackgroundMessageHandler` (data-only) → start CallKeep / a foreground call service and ring.

- [ ] On a `voip_cancel` data message → end/dismiss the CallKeep call by `uuid`.

- [ ] Ensure high-priority FCM + the call foreground-service permissions.

 

---

 

## 3. Pointing the app at the local backend (for testing)

 

The backend runs on the backend-dev's machine; it is **not deployed**. Two ways to reach it:

- **Same network:** set the app's API base URL to `http://<backend-dev-ip>:3001`.

- **ngrok (recommended, works anywhere + needed for the call service to reach it):** backend-dev runs `ngrok http 3001` and shares the `https://<id>.ngrok.app` URL; set that as the app's base URL.

 

Then **log in** → the app should call `/call-service/device-tokens` → a row is stored on the backend. (The login user must have a **calling extension** assigned, so the backend can map the ringing extension → that user.)

 

---

 

## 4. End-to-end test (real call)

 

Order of operations (backend-dev + mobile-dev together):

1. **Backend-dev:** runs backend locally with APNs (.p8) + FCM (service account) configured, exposed via ngrok.

2. **Mobile-dev:** app points at the ngrok URL, logs in as an agent who has an extension → device token registered. Confirm with backend-dev that the token row exists.

3. **Backend-dev:** registers a webhook subscription on the live call service → the ngrok URL, and enables the call service's emit flag.

4. **Make a real inbound call** to the DID that routes to that agent.

 

**Pass criteria:**

- [ ] **Locked iPhone** shows the native incoming-call screen within a few seconds.

- [ ] **Killed Android app** rings (CallKeep).

- [ ] Caller hangs up before answer → the ringing UI **dismisses** (same `uuid`).

- [ ] Answer → the app proceeds to register SIP / connect (existing calling flow).

 

---

 

## 5. Please confirm these values (so backend config matches the app)

- iOS **bundle id**: `com.rhkproperties.mobile`  ← confirm exact

- APNs **Key ID**: `UD84C7LGRZ`, **Team ID**: `UFYQ4RL447`  ← confirm

- Firebase **project**: `rhk-properties-aa6d0`  ← confirm the app uses this same project

- Whether the test build is a **dev/debug build** (APNs _sandbox_) or **TestFlight/Store** (APNs _production_) — backend must match this.

 

---

 

## 6. What is NOT needed from mobile for this

- No backend secrets on the device. The app only sends its **push token** and reads the **payload keys** above.

- The SIP/WebRTC calling flow is unchanged — this only adds the _wake_ so an incoming call can reach the app in the background.

 

has context menu
