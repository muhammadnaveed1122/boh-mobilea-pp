# Notifications Setup — Android (Beginner Guide)

This guide takes you from "the code is done" to "push notifications actually arrive on a real Android phone." Written for someone who has **never set up Android push before**. Follow it top to bottom — don't skip steps.

> **Why this is needed:** the app code is finished, but a phone can only receive push notifications if Google knows about your app. That requires a Firebase project, a config file, and a real build. None of this can be done from code — it needs you, a browser, and ~30 minutes.
>
> iOS setup is in a separate guide: [`notifications-setup-ios.md`](./notifications-setup-ios.md).

---

## 0. Before you start — what you need

| You need                                                | Why                                            | Cost | Where                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------- | ---- | --------------------------------------------------------------------------------------- |
| **Android Studio** installed                            | Compiles the Android app, ships an emulator    | Free | [developer.android.com/studio](https://developer.android.com/studio)                    |
| **Node.js 20+** and **pnpm**                            | Runs the build tools                           | Free | [nodejs.org](https://nodejs.org) · [pnpm.io/installation](https://pnpm.io/installation) |
| A **Google account**                                    | Firebase needs one (any Gmail works)           | Free | [accounts.google.com](https://accounts.google.com)                                      |
| A free **Expo account**                                 | Generates one project ID the push system needs | Free | [expo.dev/signup](https://expo.dev/signup)                                              |
| An **Android phone** OR an emulator **with Play Store** | Android push needs Google Play services        | —    | (a normal Pixel emulator from Android Studio works if you pick the "Google Play" image) |

### Words you'll see

- **FCM** = Firebase Cloud Messaging. Google's push system. Required for Android.
- **Expo Push** = a free middle-man. We send to Expo; Expo forwards to FCM. One API instead of two.
- **Push token** = a unique address for one app on one phone. Backend stores it and uses it to send pushes.
- **Prebuild** = command that turns the Expo project into a real `android/` folder so it can be compiled.
- **Package name** = the app's unique Android ID. Ours is `com.rhkproperties.mobile` (already set in `app.json`). It must match **exactly** in Firebase.

### Useful reference docs (open in tabs)

- Expo push overview → https://docs.expo.dev/push-notifications/overview/
- Expo FCM V1 setup → https://docs.expo.dev/push-notifications/fcm-credentials/
- Firebase Android setup → https://firebase.google.com/docs/android/setup

---

## 1. Create the Expo project ID (5 min, required)

The app cannot get a push token without an Expo `projectId`.

1. Make a free account at **https://expo.dev/signup** if you don't have one.
2. Open a terminal in the mobile repo:
   ```bash
   cd boh-mobile
   pnpm install                # only first time
   pnpm add -g eas-cli         # install Expo CLI globally (one time)
   eas login                   # use the email/password from step 1
   eas init                    # press Enter to accept the project name
   ```
   > If `pnpm add -g` errors with a PATH warning, run `pnpm setup` once and reopen the terminal.
3. `eas init` automatically writes a line into [`app.json`](../app.json). Open it and confirm you see:
   ```jsonc
   "extra": { "eas": { "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" } }
   ```

✅ **Done when** `app.json` has an `extra.eas.projectId`.

> We are NOT using EAS cloud builds — this step only creates the project ID Expo needs.

---

## 2. Create the Firebase project (10 min)

**Goal:** make a Firebase project, register the Android app inside it, and download `google-services.json`.

### 2a. Make the Firebase project

1. Open **https://console.firebase.google.com** and sign in with your Google account.
2. Click **Add project**.
3. Project name: `RHK Properties` (any name is fine, this is just for you).
4. Click **Continue**.
5. **Google Analytics**: turn it **OFF** (toggle the switch). You don't need it for push.
6. Click **Create project**. Wait ~30 sec, then **Continue**.

You should now see the Firebase project dashboard.

### 2b. Register the Android app

1. On the dashboard, click the **Android** icon (a green Android head). If you don't see it, click **Add app** → **Android**.
2. Fill in the form:
   - **Android package name**: `com.rhkproperties.mobile` ← copy this **exactly**, lowercase, no spaces. It must match what's in `app.json`.
   - **App nickname** (optional): `RHK Properties Mobile`.
   - **Debug signing certificate SHA-1**: leave blank. Not needed for push.
3. Click **Register app**.

### 2c. Download `google-services.json`

1. The next page says "Download `google-services.json`" — click the button.
2. A file called `google-services.json` downloads.
3. **Move that file into the mobile repo** at this exact path:
   ```
   boh-mobile/google-services.json
   ```
   (Same folder as `app.json` and `package.json`.)
4. Back in Firebase, click **Next** through the remaining steps. **Skip** the "Add Firebase SDK" and "Run your app" sections — Expo handles those for us. Click **Continue to console**.

### 2d. Wire the file into the app

Open [`app.json`](../app.json) and find the `"android"` block. Add the `googleServicesFile` line:

```jsonc
"android": {
  "package": "com.rhkproperties.mobile",
  "googleServicesFile": "./google-services.json",
  // ... keep any other existing fields
}
```

⚠️ **Only add this line AFTER `google-services.json` exists** in the repo, or the build will fail.

✅ **Done when** `google-services.json` is at `boh-mobile/google-services.json` and `app.json` references it.

---

## 3. Get the FCM service-account key for Expo (5 min)

**Why:** Expo needs permission to send pushes to FCM on your behalf. You give it a service-account key, which is like a password for a robot account.

1. Go back to **https://console.firebase.google.com** → open the **RHK Properties** project.
2. Click the **gear icon ⚙️** (top left, next to "Project Overview") → **Project settings**.
3. Click the **Service accounts** tab.
4. Scroll down. You'll see a section that says **Firebase Admin SDK**. Click **Generate new private key**.
5. A dialog warns you to keep the key safe. Click **Generate key**.
6. A `.json` file downloads — name looks like `rhk-properties-firebase-adminsdk-xxxx-xxxxxxxxxx.json`. **Save it somewhere safe** (e.g. `~/Documents/`). Do **NOT** commit it to git.

### Upload the key to Expo

> ⚠️ `eas-cli` requires an `eas.json` in the repo root. If you don't have one, see the **eas.json prerequisite** note below this section before running `eas credentials`.

```bash
cd boh-mobile
eas credentials
```

Interactive menu. Exact prompts on eas-cli **v19+**:

1. **Select platform** → `Android`
2. **Which build profile do you want to configure?** → `development`
3. **What do you want to do?** → `Google Service Account`
4. **What do you want to do?** → `Manage your Google Service Account Key for Push Notifications (FCM V1)`
5. **Set up a Google Service Account Key for Push Notifications (FCM V1)** → `Upload a new service account key`
6. **Path to Google Service Account file** → paste full path to the `.json` from step 6 above.
   - macOS tip: drag the file from Finder into the terminal — pastes the full path.
7. eas-cli uploads, validates, and links the key. You'll see a confirmation line.

Re-run `eas credentials` → **Android** → **development** → menu should now show a **Google Service Account Key for FCM V1** entry. That's the success state.

✅ **Done when** the **Google Service Account** menu shows a configured FCM V1 key.

### eas.json prerequisite

If `eas credentials` errors with `eas.json could not be found`, create a minimal one at the repo root:

```jsonc
// boh-mobile/eas.json
{
  "cli": { "version": ">= 13.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": { "autoIncrement": true },
  },
  "submit": { "production": {} },
}
```

Then retry `eas credentials`.

> Skipping this step is the #1 reason Android push silently does nothing. If pushes work for in-app banner but not when the app is closed → you missed this step.

---

## 4. Build and run on a real device (15 min first time)

Expo Go (the QR-scan app) **cannot do push notifications**. You must build a real APK once.

```bash
cd boh-mobile
npx expo prebuild               # creates the android/ folder (only first time, or after config changes)
npx expo run:android            # compiles + installs + launches
```

- Plug in your Android phone **with USB debugging enabled** (Settings → About phone → tap "Build number" 7 times → back → Developer options → enable **USB debugging**), or have an emulator running.
- First build takes 5–15 min (downloads Gradle, compiles native code). Later builds are seconds.
- On first launch the app asks **"Allow notifications?"** → tap **Allow**.

If the build fails with a `google-services` error → recheck [`app.json`](../app.json) has the `googleServicesFile` line and the file exists at `./google-services.json`.

✅ **Done when** the app opens on the device and you've accepted the notification prompt.

---

## 5. Backend setup (so the phone has something to receive)

The backend already has the push code wired up. Two things to configure.

### 5a. Optional Expo access token

Edit `boh-lead-magnet-backend/.env`:

```bash
# Optional — Expo Push works without it, but setting it raises rate limits + adds security.
# Get one at: https://expo.dev → top-right avatar → Access tokens → Create token.
EXPO_ACCESS_TOKEN=your-expo-access-token
```

### 5b. Make sure the phone can reach the backend

A real Android phone **cannot** reach `localhost` on your Mac. It must hit your computer's LAN IP.

1. Find your computer's IP (macOS):

   ```bash
   ipconfig getifaddr en0
   ```

   Output looks like `192.168.1.42`.

2. In `boh-mobile/.env` set:

   ```bash
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000
   ```

3. In `boh-lead-magnet-backend/.env` allow that origin:

   ```bash
   SOCKET_CORS_ORIGIN=http://localhost:3000,http://192.168.1.42:3000
   ```

4. Start the backend:

   ```bash
   cd boh-lead-magnet-backend
   docker compose up -d            # Postgres + Redis
   npm run prisma:migrate          # safe to re-run
   npm run dev                     # API on :3000, socket on :3002
   ```

5. Confirm the phone and your computer are on **the same Wi-Fi**.

---

## 6. Test it end-to-end

Run these in order. Stop at the first one that fails — that's where the problem is.

1. **App opens, login works.** Grant the notification prompt when asked.
2. **Token saved in DB?** In Postgres, table `device_tokens` should have a new row for your user with `platform = 'android'`.
   ```bash
   docker exec -it <postgres-container> psql -U postgres -c "SELECT user_id, platform, created_at FROM device_tokens ORDER BY created_at DESC LIMIT 5;"
   ```
3. **Realtime (app foreground):** trigger a notification (e.g. create a lead from the web app). With the app open you should see the in-app banner + the bell icon counter goes up.
4. **Real push (app closed):** swipe the app fully closed, trigger another notification → an OS notification should appear in the Android notification tray.
5. **Tap the notification:** opens the app on the right screen.
6. **Badge count:** Android app icon shows the unread number (depends on launcher); "Mark all read" clears it.
7. **Settings:** Profile → Notifications → toggle Push off → next notification → no OS push. Toggle In-App off → no banner.
8. **Log out:** the `device_tokens` row for this phone disappears.

---

## 7. If something doesn't work

| Symptom                                          | Likely cause                                       | Fix                                                                                                         |
| ------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| No "Allow notifications?" prompt                 | App was run via Expo Go, not a real build          | Run `npx expo run:android` (step 4), not `pnpm start`                                                       |
| Build fails: `google-services.json` not found    | File missing or `app.json` path wrong              | Confirm file at `boh-mobile/google-services.json`; redo step 2c/2d                                          |
| Build fails: package name mismatch               | Firebase package ≠ `app.json` package              | In Firebase, register a new Android app with `com.rhkproperties.mobile`, re-download `google-services.json` |
| App installs, but `getExpoPushTokenAsync` errors | Missing Expo `projectId`                           | Redo step 1                                                                                                 |
| In-app banner works, **no** OS push when closed  | FCM service account not uploaded                   | Redo step 3                                                                                                 |
| Push works on emulator but not real phone        | Phone has Play Services disabled / no internet     | Check Settings → Apps → Google Play services is enabled                                                     |
| Nothing realtime even with app open              | Phone can't reach socket :3002                     | Re-check LAN IP + CORS (step 5b); same Wi-Fi?                                                               |
| `device_tokens` row never appears                | Notification permission denied, or API unreachable | Toggle permission on in Android Settings; curl the API from phone's browser                                 |

---

## Quick reference — what value goes where

| Value                          | Where to get it                                                           | Where it goes                                                  |
| ------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Expo `projectId`               | `npx eas init`                                                            | auto-written to `app.json`                                     |
| `google-services.json`         | [Firebase Console](https://console.firebase.google.com) → Add Android app | `boh-mobile/google-services.json` + referenced from `app.json` |
| FCM service-account `.json`    | Firebase Console → ⚙️ → Project settings → Service accounts               | uploaded via `npx eas credentials` (Android)                   |
| `EXPO_ACCESS_TOKEN` (optional) | [expo.dev](https://expo.dev) → Access tokens                              | backend `.env`                                                 |
| LAN IP                         | `ipconfig getifaddr en0` (macOS)                                          | `boh-mobile/.env` + backend `SOCKET_CORS_ORIGIN`               |

Once steps 1–4 are done with a valid Firebase project, **no code changes are needed** — the feature is fully built.

---

## Next step

iOS setup is its own guide → [`notifications-setup-ios.md`](./notifications-setup-ios.md).
