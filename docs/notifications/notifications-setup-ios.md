# Notifications Setup — iOS (Beginner Guide)

This guide takes you from "the code is done" to "push notifications actually arrive on a real iPhone." Written for someone who has **never set up iOS push before**. Follow it top to bottom — don't skip steps.

> **Why this is needed:** the app code is finished, but an iPhone can only receive push notifications if Apple knows about your app. That requires a paid Apple Developer account, an APNs auth key, and a real build. None of this can be done from code — it needs you, a browser, a Mac, and ~45 minutes.
>
> Android setup is in a separate guide: [`notifications-setup-android.md`](./notifications-setup-android.md). Do Android first — it's free and easier — to confirm the pipeline works end-to-end.

---

## 0. Before you start — what you need

| You need                               | Why                                                | Cost         | Where                                                                                   |
| -------------------------------------- | -------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| A **Mac**                              | iOS apps can only be built on macOS                | —            | —                                                                                       |
| **Xcode** (latest from App Store)      | Compiles the iOS app, signs it, installs to device | Free         | [Mac App Store — Xcode](https://apps.apple.com/us/app/xcode/id497799835)                |
| **Xcode Command Line Tools**           | Provides `xcodebuild`, `xcrun`, simulator runtime  | Free         | After Xcode install: `xcode-select --install`                                           |
| **CocoaPods**                          | iOS native dependency manager Expo uses            | Free         | `sudo gem install cocoapods` (or `brew install cocoapods`)                              |
| **Node.js 20+** and **pnpm**           | Runs the build tools                               | Free         | [nodejs.org](https://nodejs.org) · [pnpm.io/installation](https://pnpm.io/installation) |
| An **Apple ID**                        | Login for Apple Developer site + Xcode             | Free         | [appleid.apple.com](https://appleid.apple.com)                                          |
| **Apple Developer Program** membership | Required for APNs (push) and real-device install   | **$99/year** | [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/)     |
| A free **Expo account**                | Generates one project ID the push system needs     | Free         | [expo.dev/signup](https://expo.dev/signup)                                              |
| A **physical iPhone**                  | iOS push does **not** work on the Simulator        | —            | —                                                                                       |
| Lightning / USB-C cable                | Plug iPhone into Mac to install build              | —            | —                                                                                       |

### Words you'll see

- **APNs** = Apple Push Notification service. Apple's push system.
- **`.p8` file** = APNs auth key. One per team. Lets Expo talk to Apple on your behalf.
- **Bundle ID** = the app's unique iOS ID. Ours is `com.rhkproperties.mobile` (already set in `app.json`). Must match Apple's App ID **exactly**.
- **Team ID** = 10-character code identifying your Apple Developer team.
- **Key ID** = 10-character code identifying one specific APNs key.
- **Expo Push** = a free middle-man. We send to Expo; Expo forwards to APNs. One API instead of two.
- **Push token** = a unique address for one app on one phone. Backend stores it and uses it to send pushes.
- **Prebuild** = command that turns the Expo project into a real `ios/` folder so it can be compiled.

### Useful reference docs (open in tabs)

- Expo push overview → https://docs.expo.dev/push-notifications/overview/
- Expo APNs credentials → https://docs.expo.dev/push-notifications/apns-credentials/
- Apple — Create APNs key → https://developer.apple.com/help/account/manage-keys/create-a-key/
- Apple — Manage identifiers (Bundle IDs) → https://developer.apple.com/help/account/manage-identifiers/

---

## 1. Enroll in the Apple Developer Program (one-time, ~24h approval)

If you already have a paid membership skip to step 2.

1. Go to **https://developer.apple.com/programs/enroll/** and sign in with your Apple ID.
2. Pick **Individual** (or **Organization** if you have a D-U-N-S number).
3. Pay the **$99/year** fee.
4. Apple approves within minutes to 24 hours. You'll get an email when it's active.

You cannot continue until membership is active (push key creation needs it).

---

## 2. Create the Expo project ID (5 min, required)

The app cannot get a push token without an Expo `projectId`.

> Already done as part of the Android guide? Skip this section.

1. Make a free account at **https://expo.dev/signup** if you don't have one.
2. In a terminal:
   ```bash
   cd boh-mobile
   pnpm install                # only first time
   pnpm add -g eas-cli         # install Expo CLI globally (one time)
   eas login                   # use the email/password from step 1
   eas init                    # press Enter to accept the project name
   ```
3. `eas init` writes a line into [`app.json`](../app.json). Confirm:
   ```jsonc
   "extra": { "eas": { "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" } }
   ```

✅ **Done when** `app.json` has an `extra.eas.projectId`.

---

## 3. Find your Apple Team ID (1 min)

You need this for step 4 and step 5.

1. Open **https://developer.apple.com/account** and sign in.
2. Top-right of the page, under your name, you'll see **Membership details** → click it.
3. Look for **Team ID** — a 10-character string like `A1B2C3D4E5`. **Copy it somewhere**.

✅ **Done when** you have the 10-character Team ID saved.

---

## 4. Confirm the App ID (Bundle ID) exists in Apple (5 min)

Apple needs to know about `com.rhkproperties.mobile` before push will work.

1. Go to **https://developer.apple.com/account/resources/identifiers/list** (Certificates, Identifiers & Profiles → **Identifiers**).
2. Look for an App ID with bundle id **`com.rhkproperties.mobile`**.
3. **If it exists**, click it, scroll to **Capabilities**, and confirm **Push Notifications** is ticked. If not, tick it → **Save**.
4. **If it does not exist**:
   - Click the **+** (top-left).
   - Pick **App IDs** → **Continue**.
   - Pick **App** → **Continue**.
   - **Description**: `RHK Properties Mobile`.
   - **Bundle ID**: select **Explicit**, enter `com.rhkproperties.mobile` exactly (lowercase).
   - Under **Capabilities**, tick **Push Notifications**.
   - Click **Continue** → **Register**.

✅ **Done when** `com.rhkproperties.mobile` exists with Push Notifications capability enabled.

---

## 5. Create the APNs Auth Key — the `.p8` file (5 min)

This is the credential that lets Expo send push notifications via Apple.

1. Go to **https://developer.apple.com/account/resources/authkeys/list** (Certificates, Identifiers & Profiles → **Keys**).
2. Click the **+** button (Create a key).
3. **Key Name**: `RHK Push Key`.
4. Tick **Apple Push Notifications service (APNs)**.
5. Click **Configure** next to APNs.
   - **Environment**: choose **Sandbox & Production**.
   - **Key Restriction**: pick **Team Scoped** (simpler) — leave at default.
   - Click **Save**.
6. Click **Continue** → **Register**.
7. On the confirmation screen:
   - **Download** the `.p8` file (button on the page). Filename looks like `AuthKey_ABC123XYZ.p8`.
     - ⚠️ **You can only download this file ONCE.** Save it somewhere safe (e.g. `~/Documents/apple-push-key/`). Back it up.
   - **Copy the Key ID** shown on the page (10 chars, e.g. `ABC123XYZ`). Save it.
8. Click **Done**.

✅ **Done when** you have:

- The `.p8` file saved locally
- The **Key ID** (from this screen)
- The **Team ID** (from step 3)

---

## 6. Upload the `.p8` to Expo (3 min)

> ⚠️ Requires `eas.json` in repo root. Minimal version:
>
> ```jsonc
> // boh-mobile/eas.json
> {
>   "cli": { "version": ">= 13.0.0", "appVersionSource": "remote" },
>   "build": {
>     "development": { "developmentClient": true, "distribution": "internal" },
>     "preview": { "distribution": "internal" },
>     "production": { "autoIncrement": true },
>   },
>   "submit": { "production": {} },
> }
> ```

```bash
cd boh-mobile
eas credentials
```

Interactive menu (eas-cli v19+) — answer:

1. **Select platform** → `iOS`
2. **Which build profile do you want to configure?** → `development`
3. **What do you want to do?** → `Push Notifications: Manage your Apple Push Notifications Key`
4. **Set up a Push Notifications Key** → `Add a new push key`
5. **Add a new push key** → `Upload a key`
6. **Path to .p8 file** → drag the `.p8` from Finder into the terminal (pastes full path), press Enter.
7. **Key ID** → paste the 10-char Key ID from step 5.
8. **Team ID** → paste the 10-char Team ID from step 3.

Re-run `npx eas credentials` and confirm the iOS section shows a **Push Key** with a checkmark.

✅ **Done when** `eas credentials` shows a Push Key set for iOS.

---

## 7. Build and run on a real iPhone (15 min first time)

iOS Simulator **cannot** receive push notifications. You need a physical iPhone.

### 7a. Trust your Mac on the iPhone

1. Plug the iPhone into the Mac with a USB / Lightning cable.
2. Unlock the phone. Tap **Trust This Computer** when prompted, enter passcode.

### 7b. Sign in Xcode with your Apple ID

1. Open Xcode (once installed from App Store).
2. **Xcode menu → Settings → Accounts** tab.
3. Click the **+** → **Apple ID** → sign in with the Apple ID tied to your Developer membership.
4. The team should appear in the list. Close Settings.

### 7c. Build

```bash
cd boh-mobile
npx expo prebuild               # creates the ios/ folder (only first time, or after config changes)
npx expo run:ios --device       # picks your plugged-in iPhone from a list
```

If the prebuild fails with a CocoaPods error → run `sudo gem install cocoapods` and retry.

First build takes 5–15 min (Xcode compiles native code, signs, installs). Later builds are seconds.

### 7d. Trust the developer profile on the iPhone

First time only — iOS won't run an app from an "unknown developer" until you approve.

1. On the iPhone open **Settings → General → VPN & Device Management** (or "Profiles & Device Management" on older iOS).
2. Tap your developer profile (your Apple ID's email).
3. Tap **Trust** → confirm.

Now re-launch the app on the iPhone.

### 7e. Grant notification permission

On first app launch the system asks **"...Would Like to Send You Notifications"** → tap **Allow**.

✅ **Done when** the app opens on your iPhone and you've tapped **Allow**.

---

## 8. Backend setup (so the phone has something to receive)

> Already done as part of the Android guide? Skip this section.

The backend already has the push code wired up. Two things to configure.

### 8a. Optional Expo access token

Edit `boh-lead-magnet-backend/.env`:

```bash
# Optional — Expo Push works without it, but setting it raises rate limits + adds security.
# Get one at: https://expo.dev → top-right avatar → Access tokens → Create token.
EXPO_ACCESS_TOKEN=your-expo-access-token
```

### 8b. Make sure the iPhone can reach the backend

A real iPhone **cannot** reach `localhost` on your Mac. It must hit your Mac's LAN IP.

1. Find your Mac's IP:

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

5. Confirm the iPhone and your Mac are on **the same Wi-Fi**.

---

## 9. Test it end-to-end

Run these in order. Stop at the first one that fails — that's where the problem is.

1. **App opens, login works.** Grant the notification prompt when asked.
2. **Token saved in DB?** In Postgres, table `device_tokens` should have a new row for your user with `platform = 'ios'`.
   ```bash
   docker exec -it <postgres-container> psql -U postgres -c "SELECT user_id, platform, created_at FROM device_tokens ORDER BY created_at DESC LIMIT 5;"
   ```
3. **Realtime (app foreground):** trigger a notification (e.g. create a lead from the web app). With the app open you should see the in-app banner + the bell icon counter goes up.
4. **Real push (app closed):** swipe the app fully closed (swipe up + hold + flick), trigger another notification → an iOS notification should appear on the lock screen / banner.
5. **Tap the notification:** opens the app on the right screen.
6. **Badge count:** iOS app icon shows a red unread number; "Mark all read" clears it.
7. **Settings:** Profile → Notifications → toggle Push off → next notification → no OS push. Toggle In-App off → no banner.
8. **Log out:** the `device_tokens` row for this phone disappears.

---

## 10. If something doesn't work

| Symptom                                                 | Likely cause                                       | Fix                                                                                                         |
| ------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| No "Allow notifications?" prompt                        | App was run via Expo Go, not a real build          | Run `npx expo run:ios --device` (step 7c), not `pnpm start`                                                 |
| Build fails: "No signing certificate found"             | Xcode not signed in / wrong team                   | Xcode → Settings → Accounts; or open `ios/*.xcworkspace` → target → Signing & Capabilities → pick your team |
| Build fails: "Untrusted developer" on iPhone            | Profile not trusted on device                      | Settings → General → VPN & Device Management → Trust (step 7d)                                              |
| In-app banner works, **no** OS push when closed         | APNs key not uploaded, or wrong Key/Team ID        | Redo step 6; double-check Key ID + Team ID match the ones from the Apple site                               |
| Push works in dev but not after TestFlight              | APNs key configured for Sandbox only               | Re-create key with **Sandbox & Production** (step 5.5)                                                      |
| App installs, `getExpoPushTokenAsync` errors            | Missing Expo `projectId`                           | Redo step 2                                                                                                 |
| Push works on Simulator (in-app only)                   | Expected — iOS Simulator cannot receive APNs       | Use a real iPhone                                                                                           |
| Nothing realtime even with app open                     | iPhone can't reach socket :3002                    | Re-check LAN IP + CORS (step 8b); same Wi-Fi?                                                               |
| `device_tokens` row never appears                       | Notification permission denied, or API unreachable | Settings → Notifications → RHK app → enable; curl API from Safari on phone                                  |
| "Provisioning profile doesn't include push entitlement" | App ID missing Push capability                     | Redo step 4 — tick **Push Notifications** on the App ID                                                     |

---

## Quick reference — what value goes where

| Value                                | Where to get it                                                                                     | Where it goes                                    |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Expo `projectId`                     | `npx eas init`                                                                                      | auto-written to `app.json`                       |
| Apple `.p8` key                      | [developer.apple.com → Keys](https://developer.apple.com/account/resources/authkeys/list)           | uploaded via `npx eas credentials` (iOS)         |
| Apple **Key ID**                     | Shown on the page when creating the key                                                             | entered in `npx eas credentials`                 |
| Apple **Team ID**                    | [developer.apple.com → Membership](https://developer.apple.com/account#MembershipDetailsCard)       | entered in `npx eas credentials`                 |
| Bundle ID `com.rhkproperties.mobile` | [developer.apple.com → Identifiers](https://developer.apple.com/account/resources/identifiers/list) | already in `app.json`                            |
| `EXPO_ACCESS_TOKEN` (optional)       | [expo.dev](https://expo.dev) → Access tokens                                                        | backend `.env`                                   |
| LAN IP                               | `ipconfig getifaddr en0`                                                                            | `boh-mobile/.env` + backend `SOCKET_CORS_ORIGIN` |

Once steps 1–7 are done with a valid Apple Developer account, **no code changes are needed** — the feature is fully built.

---

## Previous step

Android setup → [`notifications-setup-android.md`](./notifications-setup-android.md).
