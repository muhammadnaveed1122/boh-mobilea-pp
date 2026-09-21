# Notifications Build — Knowledge Base (onboarding)

**Read this + `notifications-progress.md` before touching any task.** Background explainer: `notifications-explainer.md`.

## What we are building

Native push + in-app banners + a notification center for `boh-mobile`, mirroring the working web implementation in `boh-lead-magnet`, plus the missing backend pieces (device-token storage + Expo push send) in `boh-lead-magnet-backend`.

Three workstreams: **Backend (BE)** and **Mobile-Foundation (MF)** run in parallel (separate repos); **Integration (INT)** is last and needs the new backend endpoints (BE-3) deployed.

## Locked decisions

- **Provider: Expo Push.** Mobile gets an Expo push token via `expo-notifications`; backend sends via `expo-server-sdk`. One SDK covers iOS/APNs + Android/FCM.
- **Preferences: web parity.** Exactly 2 global toggles reusing existing `User.notificationsEnabled` (in-app banners) + `User.pushNotificationsEnabled` (OS push). Persisted via existing `PATCH /api/v1/auth/profile`. No new preference model/table.
- **Build: local prebuild only.** No `eas.json`, no EAS cloud builds. `expo prebuild` + `expo run:ios|android`. Dev manually manages Apple APNs `.p8` + Android `google-services.json`/FCM creds.
- **Expo projectId** is the only Expo-account touchpoint: one-time `npx eas init` writes `extra.eas.projectId` into `app.json`. `getExpoPushTokenAsync({ projectId })` requires it. Not optional.

## Data contract (exact — do not drift)

```ts
Notification = {
  id: string; userId: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: 'leads'|'meetings'|'submissions'|'projects'|'listings'
          |'developers'|'offers'|'users-agents'|'roles'|'system-auth';
  title: string; body: string;
  data: { redirectUrl?: string; actorName?: string; actorAvatarUrl?: string; [k:string]:unknown } | null;
  silent: boolean; isRead: boolean; readAt: string | null; createdAt: string;
}
PaginatedNotifications = { items: Notification[]; total; page; limit; totalPages }
```

`silent: true` → no banner, no push (DB record only). Category label map = verbatim from web `notificationCategories.ts`.

## Endpoints

| Method | Path                                               | Status                       |
| ------ | -------------------------------------------------- | ---------------------------- |
| GET    | `/api/v1/notifications?page&limit&isRead&category` | exists                       |
| GET    | `/api/v1/notifications/unread-count`               | exists                       |
| PATCH  | `/api/v1/notifications/:id/read`                   | exists                       |
| PATCH  | `/api/v1/notifications/read-all`                   | exists                       |
| POST   | `/api/v1/notifications/device-tokens`              | **NEW — BE-3**               |
| DELETE | `/api/v1/notifications/device-tokens`              | **NEW — BE-3**               |
| PATCH  | `/api/v1/auth/profile`                             | exists (accepts the 2 flags) |

`apiClient` auto-unwraps the success envelope. Socket: `io(<apiHost>:3002, { auth:{ token }, transports:['websocket','polling'], path:'/socket.io', reconnection:true, reconnectionDelay:1000, reconnectionDelayMax:5000, reconnectionAttempts:5 })`. Events: `notification` (full payload), `notification:count` (`{count}`). Room: `user:{userId}`. Backend gateway reads JWT from handshake `auth.token`.

## File map

**Backend (modify/add):** `prisma/schema/notifications.prisma`, `prisma/schema/users.prisma`, `src/config/expo-push.configuration.ts` (new), `src/modules/notifications/{notification.controller,notification.service,notification.module,expo-push.service(new),dto/*}.ts`, `src/core/queue/processors/notification.processor.ts`, `src/core/queue/queue.module.ts`.

**Mobile (add):** `src/features/notifications/{types.ts,services.ts,constants/categories.ts,store/notifications.store.ts,utils/resolve-redirect.ts,hooks/*,components/*}`, `src/lib/{socket.ts,push-notifications.ts}`, `src/components/atoms/{Switch,Skeleton,EmptyState}.tsx`, `app/(app)/notifications.tsx`, `app/(app)/notification-settings.tsx`. **(modify):** `app/_layout.tsx`, `src/features/profile/components/ProfileScreen.tsx` (~line 101 placeholder), `src/store/auth.store.ts`, `app.json`.

**Web reference (port verbatim where noted):**

- Socket: `boh-lead-magnet/src/context/SocketContext.tsx:121-129,34-44,46-74`
- Provider logic: `boh-lead-magnet/src/features/notifications/context/NotificationsProvider.tsx:102-154,165`
- Model/categories: `…/notifications/models/notification.ts`, `…/notifications/constants/notificationCategories.ts`
- Filter/group/date-label: `…/notifications/hooks/useNotifications.ts:13-141`
- Center UI: `…/notifications/pages/NotificationsPage.tsx`
- Avatar: `…/notifications/components/NotificationAvatar.tsx`
- Banner: `…/notifications/components/NotificationBannerPortal.tsx`
- Slices: `…/notifications/slices/{notificationsSlice,notificationBannersSlice}.ts`
- Settings: `…/auth/components/profile/NotificationSettingsCard.tsx`

**Mobile patterns to follow:** `src/features/leads/{services.ts, hooks/use-lead-detail.ts, hooks/use-create-lead.ts}`, `src/components/atoms/Checkbox.tsx` (RNR primitive pattern), `src/lib/rbac/use-permission-sync.ts` (AppState foreground), `src/components/organisms/MainHeader.tsx` (bell+badge props already exist), `app/_layout.tsx` (provider/portal mount + auth hydration gating).

**Backend patterns:** clone `Notification` model in `notifications.prisma`; route style `notification.controller.ts`; outbound-SDK `src/modules/verification/adapters/onfido.adapter.ts`; config `src/config/socket.configuration.ts`; processor injection `notification.processor.ts`; prefs persistence `auth.service.ts` (already supports the 2 flags).

## Conventions

- **Mobile:** TanStack Query + Zustand (NOT Redux/RTK). axios `apiClient` (base `/api/v1`, envelope auto-unwrapped, token interceptors). RNR primitives = `@rn-primitives/*` + `cva` + `cn` + `TextClassContext`, semantic Tailwind tokens (no hex). Feature-folder pattern. Package manager **pnpm** — always `npx expo install` (never hand-edit SDK-pinned versions). Path alias `@/` → `src`. No test runner (eslint + prettier only) — verification is manual.
- **Backend:** NestJS v11, multi-file Prisma (`prisma/schema/`), `@itgorillaz/configify` (`@Configuration`/`@Value`, auto-discovered), BullMQ, `@AuthenticatedOnly()` + `@CurrentUser()`. Push code must **never throw out of the notification job**.

## Critical rules

- Device-token register = **upsert by `token`** (unique), never delete-all-by-user → multi-device safe.
- Foreground: suppress OS banner (`setNotificationHandler` → `shouldShowBanner:false`), show our in-app banner instead (mirrors web in-app/push split, avoids double).
- Cold-start token registration + tap navigation must run AFTER auth hydration + router mount.
- Prune `DeviceNotRegistered` tokens from Expo receipts.
- Resync app badge to unread on foreground catch-up and clear (0) on logout/mark-all-read.

## Gotchas log (append as discovered)

- 2026-05-15 — `npx expo install` shells out to **npm** (stale `package-lock.json` is
  detected) and fails with a `rn-international-phone-number` peer-dep conflict.
  Use `pnpm add <pkg>` directly instead. Installed SDK-54-aligned versions:
  expo-notifications 0.32.17, expo-device 8.0.10, socket.io-client 4.8.3
  (matches backend socket.io 4.8.3), @rn-primitives/switch 1.4.0.

- 2026-05-15 — Runtime `Cannot find native module 'ExpoDevice'`: native modules
  (`expo-device`, `expo-notifications`) aren't in the JS-only/Expo-Go binary, so
  a top-level `import * as Device from 'expo-device'` crashed at load and
  cascaded into `No QueryClient` errors in unrelated screens. Fix: `expo-device`
  resolved via optional `require()` with a `Platform.OS` fallback +
  `configureForegroundHandler` wrapped in try/catch (see `src/lib/push-notifications.ts`).
  App no longer crashes pre-rebuild; **OS push still requires a native rebuild**
  (`expo prebuild` + `expo run:ios|android`). Don't reintroduce a top-level
  `expo-device` import.

## ⚠️ OS PUSH TEMPORARILY DISABLED (2026-05-15)

iOS build failed: Apple App ID `com.rhkproperties.mobile` lacks the Push
Notifications capability, so the `aps-environment` entitlement was rejected by
the provisioning profile. To unblock the dev build, push was disabled:

Reason: the Apple team is a **free/personal team**, which cannot use the Push
Notifications capability anywhere (not just unregistered — unsupported).

- `expo-notifications` plugin entry removed from `app.json`.
- `app.config.js` added: a `withEntitlementsPlist` config plugin that **deletes
  `aps-environment` on every prebuild**, after `expo-notifications` auto-injects
  it. Durable — no manual file editing; survives `expo prebuild` / `expo run:ios`.
  Verified: entitlements emit `<dict/>`.

App builds + runs on the personal team; notification center / socket / in-app
banner work; OS push + token registration no-op (guarded in
`src/lib/push-notifications.ts`).

**To RE-ENABLE push:** (1) use a **paid** Apple Developer team + enable the
Push Notifications capability on App ID `com.rhkproperties.mobile`; (2) delete
`app.config.js`; (3) restore the `expo-notifications` plugin block in
`app.json`; (4) `npx expo prebuild --clean` + `npx expo run:ios --device`;
(5) APNs `.p8` + Android FCM to the Expo project (see below).

## MF-1 remaining MANUAL steps (dev-performed — push is untestable until done)

These need an Expo account / native creds and cannot be automated here:

1. `npx eas init` in `boh-mobile` → writes `extra.eas.projectId` into `app.json`.
   Required: `getExpoPushTokenAsync({ projectId })` returns nothing without it.
2. Add `"android": { "googleServicesFile": "./google-services.json" }` to
   `app.json` AFTER placing the Firebase `google-services.json` in the repo root
   (do not add the key before the file exists — it breaks prebuild).
3. Apple: create APNs Auth Key `.p8`, upload to the Expo project
   (`eas credentials` → iOS → Push Notifications).
4. Android: create Firebase project (package `com.rhkproperties.mobile`),
   download `google-services.json`, and upload the FCM V1 service-account JSON
   to the Expo project (`eas credentials` → Android → FCM). Without this,
   iOS push works but Android silently fails.
5. `npx expo prebuild` then `npx expo run:ios --device` / `npx expo run:android`
   (physical iOS device — Simulator cannot receive remote push).
   The `expo-notifications` plugin is already in `app.json`.

## Decisions log (append when a choice is made)

- 2026-05-15 — Provider=Expo Push, prefs=2-toggle web parity, build=local prebuild. (initial plan)
