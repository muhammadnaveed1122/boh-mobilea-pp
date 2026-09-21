# Notifications — Beginner's Guide (Current System + Mobile Challenges)

This document explains, in plain language, **how notifications work today** in the BOH system, and **why making them feel "native" and smooth on mobile is hard**. No prior knowledge assumed.

---

## 1. What is a "notification" here?

A notification is a small message telling a user something happened: _"A new lead was assigned to you"_, _"Your password was reset"_, etc.

In this system a notification can show up in **three** different ways:

1. **In-app banner** — a small toast that slides in while you are actively using the app.
2. **Notification center** — a dedicated page listing all your past notifications (read + unread), with filters.
3. **OS / browser notification** — the popup your operating system shows (the thing that appears even when you're not looking at the app).

Today the system does **#1 and #2 well**. **#3 is only partially real** — and that gap is the heart of the mobile challenge.

---

## 2. The three parts of the system

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Web Frontend   │     │       Backend        │     │   Mobile App    │
│ (boh-lead-      │◄───►│ (boh-lead-magnet-    │◄───►│  (boh-mobile)   │
│   magnet)       │     │      backend)        │     │                 │
│ Next.js/React   │     │ NestJS + Prisma + DB │     │ Expo / React    │
│ RTK Query       │     │ BullMQ queue         │     │  Native         │
│ Socket.IO client│     │ Socket.IO server     │     │ (NO notifs yet) │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
```

- **Web frontend** — the existing, working notification UI.
- **Backend** — creates, stores, and delivers notifications.
- **Mobile app** — has **no notification feature at all** yet. This is what we are adding.

---

## 3. How a notification is born (backend side)

Think of the backend like a post office.

**Step 1 — Something happens.**
A lead gets created. Code somewhere calls a helper like `NotificationHelper.notifyUsers(...)`.

**Step 2 — A job is queued, not sent immediately.**
The helper does **not** send the notification right away. It drops a "job" into a **BullMQ queue** (a to-do list for the server). This keeps the app fast — the user who created the lead doesn't wait for notifications to be processed.

**Step 3 — A worker processes the job.**
A background worker (`notification.processor.ts`) picks up the job and:

- **Saves a row in the database** (the `Notification` table — id, userId, title, body, category, `isRead`, etc.).
- **Pushes it out live** through Socket.IO (explained next).

```
Lead created
   │
   ▼
NotificationHelper.notifyUsers()   ← "write a letter"
   │
   ▼
BullMQ queue                       ← "drop in mailbox"
   │
   ▼
NotificationProcessor              ← "postman picks it up"
   ├─► Save to database  (permanent record)
   └─► Emit via Socket.IO (instant delivery to anyone online)
```

**Key idea:** the **database** is the permanent record (powers the notification center list). **Socket.IO** is the instant doorbell (powers the live banner).

---

## 4. How the web app receives + shows notifications

### 4a. Real-time delivery: Socket.IO

**Socket.IO** is a permanent two-way phone line between the browser and the server (a WebSocket). While the web page is open, the browser holds this line open.

- The server puts each user in a "room" named `user:{userId}`.
- When a notification is processed, the server emits a `notification` event into that user's room.
- The browser is listening; the moment the event arrives, it reacts instantly — no refresh, no polling.

> **Plain analogy:** Socket.IO is like leaving a phone call connected. The server can speak any time and you hear it immediately — but only **while the call is connected** (i.e. while the tab is open).

### 4b. What the web does when a notification arrives

When the `notification` event fires, the web app (`NotificationsProvider`):

1. Adds it to the in-memory list (so the notification center updates).
2. If it's not "silent" **and** in-app alerts are ON → shows a **toast banner**.
3. If it's not "silent" **and** push is ON → shows a **browser notification** via the Service Worker.

### 4c. The notification center page (`/my-account/notifications`)

A normal page that fetches notifications from the backend over regular HTTP (RTK Query):

| Action                         | Backend endpoint                  |
| ------------------------------ | --------------------------------- |
| List notifications (paginated) | `GET /notifications`              |
| Unread count                   | `GET /notifications/unread-count` |
| Mark one read                  | `PATCH /notifications/:id/read`   |
| Mark all read                  | `PATCH /notifications/read-all`   |

It has: All / Unread tabs, search, category filter, date filter, "mark all as read", and pagination.

### 4d. The two settings toggles

On the account/settings area there are **two switches** stored on the user's profile:

- `notificationsEnabled` → show in-app banners or not.
- `pushNotificationsEnabled` → show browser OS popups or not.

These are saved via `PATCH /auth/profile`.

---

## 5. The important truth about "push" on web today

This is the most misunderstood part, so read slowly.

The web app **has** a Service Worker (`sw.js`) with code to handle a browser `push` event. **But** there is **no code that registers a real web-push subscription** and sends it to the backend, and the backend has **no web-push / VAPID sending code**.

**Conclusion:** Today, "push" on web is effectively just a **browser notification popup triggered by the live Socket.IO event while the tab is open**. It is **not** true background push. If the browser tab is closed, nothing arrives until the page is opened again.

So when we say _"web has push notifications"_, the honest version is:

> Web has **real-time in-app notifications + a notification center**, and shows a browser popup **only while the site is open**. There is no true server-initiated background push anywhere in the system yet.

This matters enormously for mobile, because on mobile, users **expect** the OS popup to arrive when the app is closed — and that piece **does not exist in the backend at all**.

---

## 6. Where the mobile app stands today

The mobile app (`boh-mobile`) is an **Expo / React Native** app. Relevant facts:

- **No notification feature exists** — no notification center, no settings screen, no real-time client.
- The Profile screen already shows a **"Notifications" menu item**, but it's a dead placeholder (goes nowhere).
- State management is **different from web**: mobile uses **Zustand + TanStack Query**, _not_ Redux/RTK Query. So web notification code **cannot be copy-pasted** — it must be re-implemented in mobile's patterns.
- HTTP goes through a shared `apiClient` (axios) with auth-token interceptors — easy to reuse for the notification endpoints.
- **No push libraries** installed (`expo-notifications`, Firebase, etc. — none).
- **No EAS build config** and no push entries in `app.json`.

Good news: the four notification HTTP endpoints already work and need **no changes** to power a mobile notification center.

---

## 7. The challenges for "super smooth native feeling" mobile notifications

Here is why mobile is meaningfully harder than "just reuse the web code".

### Challenge 1 — Foreground vs Background vs Killed

A web tab is basically only ever "open" or "closed". A mobile app has **three** states, each needing different handling:

| App state                      | What user expects       | What's needed                       |
| ------------------------------ | ----------------------- | ----------------------------------- |
| **Foreground** (using app)     | Smooth in-app banner    | Socket.IO live event + in-app toast |
| **Background** (app minimized) | OS notification in tray | **True push from a server**         |
| **Killed** (swiped away)       | OS notification in tray | **True push from a server**         |

Socket.IO **only works in the foreground**. The OS suspends network sockets when the app is backgrounded/killed to save battery. So real-time sockets **cannot** deliver background notifications. Only a real push service can.

### Challenge 2 — True OS push requires a whole pipeline the backend doesn't have

For an OS notification to arrive while the app is closed, you need:

1. **A device push token** — every install gets a unique token from Apple (APNs) / Google (FCM) / Expo's push service.
2. **Somewhere to store it** — backend needs a `DeviceToken` table (does not exist) and an endpoint to register/unregister it (does not exist).
3. **A push provider in the backend** — the notification processor must, after saving to DB, call Expo Push / FCM / APNs to actually deliver. **None of this exists.**

So "smooth native push" is **not a mobile-only task** — it requires real backend additions.

### Challenge 3 — Expo Go limitation (build pipeline)

Remote push notifications **do not work in Expo Go** for current SDKs. Testing real push requires a **development build** (and EAS build setup), which doesn't exist yet. This adds devops/build work, not just code.

### Challenge 4 — Socket.IO on mobile is trickier than on web

Even just for foreground real-time, mobile must handle things the web never worries about:

- **Reconnect on resume** — when the app returns from background, the socket is dead and must reconnect, then **catch up on missed notifications** (refetch from the DB so nothing is lost).
- **Auth token refresh** — the socket connection must use the current token; mobile rotates tokens via interceptors.
- **Battery / lifecycle** — connect on foreground, disconnect on background to avoid battery drain and crashes.

### Challenge 5 — Permissions are explicit and can be permanently denied

Mobile OSes require the user to **grant** notification permission (iOS always; Android 13+ also). If the user denies it, you cannot ask again — you must deep-link them to OS settings. The UX must handle "denied" gracefully (this is similar in spirit to the web's permission flow but stricter).

### Challenge 6 — The "native polish" details

To actually _feel_ native (not like a web page in a wrapper), we also need:

- **App icon badge count** (the little red number).
- **Tap-to-open deep linking** — tapping a notification should jump straight to the relevant lead/project screen (notifications carry a `data.redirectUrl`).
- **Grouping, sounds, haptics**, and correct behavior when multiple arrive.
- **Unread badge on a header bell**, kept in sync with the DB.

### Challenge 7 — Architecture must match mobile, not web

Because mobile uses Zustand + TanStack Query (not RTK), we must build:

- TanStack Query hooks for the four endpoints.
- A Zustand store (or context) for the live socket + unread state.
- Feature-folder structure matching existing mobile conventions (`src/features/notifications/` with `components/`, `hooks/`, `services.ts`, `types.ts`).

---

## 8. Summary in one paragraph

Today the backend reliably **stores** notifications and **pushes them live over Socket.IO to whoever is currently online**. The web app uses that to show in-app banners and a notification center; its "browser push" only works while the site is open. The mobile app has **none of this yet**. Re-creating the foreground experience (notification center + settings + live banners) is achievable **inside the mobile repo alone, with no backend changes**. But delivering notifications **when the app is closed** — the thing users most associate with "native push" — requires **new backend infrastructure** (device-token storage + a push provider) plus an EAS development build. These are two clearly separable phases, and the recommended approach is to build the foreground/real-time experience first and treat true background push as an explicit phase 2.

---

## 9. Mini glossary

| Term                                 | Plain meaning                                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Socket.IO / WebSocket**            | A permanent open phone line between app and server for instant messages. Foreground only on mobile. |
| **BullMQ queue**                     | A server to-do list so heavy work happens in the background.                                        |
| **Push token**                       | A unique address for one app install, used by Apple/Google to deliver OS notifications.             |
| **APNs / FCM**                       | Apple's and Google's official push delivery services.                                               |
| **Expo Push**                        | A wrapper service that talks to APNs/FCM for you so you don't manage both directly.                 |
| **Foreground / Background / Killed** | App on screen / minimized / fully closed. Each needs different notification handling.               |
| **Service Worker**                   | A web-only background script. Mobile uses native push instead — not the same thing.                 |
| **Notification center**              | The in-app list/history page of all notifications.                                                  |
| **EAS / dev build**                  | Expo's cloud build; needed because real push doesn't work in Expo Go.                               |

---

_Next step (after you've read this): decide scope — foreground/real-time parity only, full native background push, or phased — so the implementation plan can be written._
