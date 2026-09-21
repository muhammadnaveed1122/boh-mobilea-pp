# Backend Spec — Incoming-Call VoIP Push (for the backend agent)

Concise build spec for the **backend** half of mobile incoming-call wakes. The
mobile client side is already implemented (see
[`calling-native-setup-ios.md`](./calling-native-setup-ios.md) status banner and
[`calling-native-setup-android.md`](./calling-native-setup-android.md)). The
backend does NOT exist yet — build the two pieces below.

Why not Expo Push: Expo cannot send Apple **PushKit** pushes nor **data-only
high-priority** FCM. The backend must talk to **APNs HTTP/2** (iOS) and
**firebase-admin** (Android) directly.

---

## 1. Device-token endpoint

```
POST /api/v1/call-service/device-tokens
Authorization: Bearer <user access token>     # same auth as the rest of the app
Content-Type: application/json

{ "platform": "ios" | "android", "kind": "voip" | "fcm", "token": "<string>" }
```

- The mobile client calls this from `registerCallDeviceToken()` whenever the
  call-wake token is issued/rotated. `kind` is `'voip'` for iOS, `'fcm'` for Android.
- **Upsert** by `(userId, platform, kind)`; overwrite `token` with the latest.
- Reuse the user's SIP **extension** mapping so an inbound call can resolve which
  device token(s) to wake (the agent extension ↔ userId link already exists for
  the speed-to-lead routing).
- Soft-delete / mark stale tokens that APNs/FCM report as unregistered.
- (Optional) `DELETE /api/v1/call-service/device-tokens` with `{ token }` for sign-out.

---

## 2. Send path — trigger on inbound SIP

When FreeSWITCH bridges an inbound call to an agent extension:

1. Resolve the agent `userId` from the extension.
2. Look up their call-wake tokens.
3. Send the platform-appropriate push (below) with a fresh **call `uuid`** (v4).
4. **Park / ring-timeout the SIP leg ~15–20 s** so the woken app has time to
   register SIP and `accept()`. If no answer in that window, hang up / voicemail.

### Shared payload (both platforms)

```json
{
  "type": "voip_incoming",
  "uuid": "<uuidv4>",
  "caller_name": "<display name>",
  "call_handle": "<e164 or extension>"
}
```

The client reads exactly these keys (`voip-push-ios.ts`, `fcm-call-messaging.ts`).
The `uuid` MUST be the same one used to later cancel the call if the caller hangs
up before answer.

### iOS — APNs HTTP/2 PushKit

```
POST https://api.push.apple.com/3/device/<voip-token>      # prod
POST https://api.sandbox.push.apple.com/3/device/<voip-token>   # dev/TestFlight
apns-topic: com.rhkproperties.mobile.voip      # NOTE the .voip suffix
apns-push-type: voip
apns-priority: 10
authorization: bearer <APNs JWT>               # token (.p8) auth — see env vars

body: { "aps": {}, "type": "voip_incoming", "uuid": "...", "caller_name": "...", "call_handle": "..." }
```

- Use **token-based (.p8) auth** (recommended — no expiry) OR a VoIP Services
  `.p12` cert. Either way the topic is `<bundle>.voip`.
- Every VoIP push the device receives is reported to CallKit synchronously by the
  native shim — so do not send a VoIP push unless you intend to ring a call.

### Android — firebase-admin (data-only, high priority)

```js
admin.messaging().send({
  token: fcmToken,
  data: { type: 'voip_incoming', uuid, caller_name, call_handle }, // strings only
  android: { priority: 'high' }, // NO `notification` block
});
```

- **Must be data-only** (no `notification` key) so the app's headless
  `setBackgroundMessageHandler` fires when killed/locked and rings CallKeep.

---

## 3. Env vars

| Var                   | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| `APNS_KEY_ID`         | APNs `.p8` key id (token auth)                               |
| `APNS_TEAM_ID`        | Apple team id — `UFYQ4RL447` (RHK Properties LLC)            |
| `APNS_AUTH_KEY`       | `.p8` key contents (PEM)                                     |
| `APNS_BUNDLE_ID`      | `com.rhkproperties.mobile`                                   |
| `APNS_VOIP_TOPIC`     | `com.rhkproperties.mobile.voip`                              |
| `APNS_ENV`            | `sandbox` \| `production` (selects APNs host)                |
| `FCM_SERVICE_ACCOUNT` | firebase-admin service-account JSON (already used elsewhere) |

---

## 4. Acceptance checklist

- [ ] `POST /device-tokens` upserts per `(userId, platform, kind)` and returns 2xx.
- [ ] Inbound call to an agent with a registered iOS token rings the iPhone (locked) within a few seconds.
- [ ] Inbound call to an agent with a registered Android token rings a killed app.
- [ ] Same `uuid` is reused to cancel an unanswered call (so the device dismisses the CallKit/CallKeep UI).
- [ ] Stale tokens (APNs `410` / FCM `UNREGISTERED`) are pruned.
