# Deploy to Google Play Store — Beginner Guide (Android)

This is a step-by-step, beginner-friendly guide to get **RHK Properties** onto the
Google Play Store. It assumes you have never published an app before.

We use **EAS** (Expo Application Services) — it builds the app in the cloud and
uploads it to Google for you, so you don't need Android Studio or signing keys on
your own machine. A manual fallback (Android Studio) is at the bottom.

App facts you'll reuse:

| Thing               | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| App name            | RHK Properties                                                   |
| Android package     | `com.rhkproperties.mobile`                                       |
| EAS project         | `rhkdev/rhk-properties`                                          |
| Store output format | **AAB** (Android App Bundle — Play Store requires this, not APK) |

---

## 0. One-time accounts you need

1. **Google Play Developer account** — costs **$25 once** (lifetime).
   - Go to https://play.google.com/console → sign in with the Google account that
     should own the app → pay the $25 → fill the developer profile.
   - Approval can take a few hours to a couple days. Do this first.
2. **Expo account** — free. You already have one (`rhkdev`). Sign in:
   ```bash
   npx eas login
   ```
3. **Node + the project installed locally.** From the repo:
   ```bash
   cd boh-mobile
   pnpm install
   ```

> You do NOT need to create a signing keystore by hand. EAS generates and stores
> one for you the first time you build. Keep it safe — losing it means you can't
> update the app later (see "Keystore" note at the end).

---

## 1. Create the app entry in Play Console

1. Open https://play.google.com/console → **Create app**.
2. Fill in:
   - App name: `RHK Properties`
   - Default language: English (US) (or your choice)
   - App or game: **App**
   - Free or paid: **Free** (you can't switch paid→free later, but free→paid is fine)
   - Accept the declarations → **Create app**.
3. You now land on the app dashboard. Leave it open — you'll come back.

---

## 2. Build the production AAB with EAS

From `boh-mobile`:

```bash
npx eas build --platform android --profile production
```

What happens:

- EAS reads the `production` profile in [`eas.json`](../../eas.json) (it has
  `autoIncrement: true`, so the version code bumps automatically every build).
- First run: EAS asks **"Generate a new Android Keystore?"** → answer **Yes**.
  EAS creates and stores it for you.
- The build runs in the cloud (~10–20 min). You get a URL to watch it.
- When done, you get a downloadable **`.aab`** file. Download it.

> Tip: check progress anytime with `npx eas build:list`.

---

## 3. First upload must be manual (then it gets easier)

Google requires the **very first** AAB of a brand-new app to be uploaded by hand
in the Play Console. After that, EAS Submit can automate uploads.

1. In Play Console → your app → **Test and release** → **Production** (or start
   with **Internal testing** — recommended for the first try, see box below).
2. **Create new release**.
3. Under **App bundles**, click **Upload** and pick the `.aab` you downloaded.
4. Fill **Release name** (e.g. `1.0.0`) and **Release notes**.
5. **Next** → **Save**. Don't submit for review yet — finish the store listing first
   (Step 4).

> **Strongly recommended: use Internal testing first.**
> Internal testing skips the multi-day Google review and lets up to 100 testers
> install immediately via a link. Path: **Test and release → Testing → Internal
> testing → Create release**. Same upload steps. Promote to Production once happy.

---

## 4. Fill the store listing (required before review)

Play Console flags everything required with a checklist. The big ones:

1. **Store listing** (Grow → Store presence → Main store listing):
   - Short description (≤80 chars) and full description.
   - **App icon**: 512×512 PNG.
   - **Feature graphic**: 1024×500 PNG.
   - **Screenshots**: at least 2 phone screenshots (take them from a running build).
2. **Store settings**: app category (e.g. Business / Real Estate), contact email.
3. **Privacy policy URL** — REQUIRED. Must be a public URL. If you don't have one,
   host a simple page (the web frontend can serve `/privacy`).
4. **App content** (Policy → App content) — answer every section:
   - Privacy policy
   - Ads (does the app show ads? likely No)
   - **Data safety** — declare what data you collect (this app collects account
     info, uses the microphone for calls, sends push notifications). Be honest;
     mismatches cause rejection.
   - Content rating questionnaire
   - Target audience (not for children → adults)
   - Permissions: it asks about sensitive permissions. This app uses
     `RECORD_AUDIO` (calls) and `POST_NOTIFICATIONS` — explain calling/notifications.
5. **Government / financial / health declarations** — answer No unless applicable.

Work down the left-side checklist until every item has a green check.

---

## 5. Submit for review

1. Go back to **Production** (or Internal testing) → your saved release →
   **Send for review** (or **Rollout to Production**).
2. Internal testing: live in minutes.
3. Production: Google reviews it. First review of a new app often takes **a few days
   to ~7 days**. Later updates are faster.

You'll get an email when approved or if changes are needed.

---

## 6. Updating the app later (the easy path)

Once the app exists in Play Console, future releases can skip the manual upload.

1. Bump the user-facing version if needed in [`app.json`](../../app.json)
   (`expo.version`, e.g. `1.0.0` → `1.0.1`). The internal version code
   auto-increments via EAS (`autoIncrement: true`), so you don't touch that.
2. Build:
   ```bash
   npx eas build --platform android --profile production
   ```
3. Submit straight to Google with EAS Submit:
   ```bash
   npx eas submit --platform android --profile production --latest
   ```

   - First time, EAS asks for a **Google Service Account key** (a JSON file) so it
     can upload on your behalf. Set it up once:
     Play Console → **Setup → API access** → create/link a service account in
     Google Cloud → grant it "Release" permission → download the JSON → point EAS
     at it (or paste the path when prompted). EAS docs:
     https://docs.expo.dev/submit/android/
4. In Play Console, promote the uploaded build from a testing track to Production
   when ready.

---

## Keystore — don't lose it (important)

The Android signing keystore EAS generated identifies your app to Google forever.
If you lose it AND haven't enabled Play App Signing, you can never update the app.

- This app uses EAS-managed credentials, so the keystore lives on Expo's servers.
- Back it up locally too:
  ```bash
  npx eas credentials   # → Android → Keystore → download
  ```
  Store the downloaded `.jks` and its passwords somewhere safe (password manager).
- Also enable **Play App Signing** (Play Console offers this on first upload —
  accept it). It lets Google recover signing if your upload key is ever lost.

---

## Troubleshooting

- **"Version code already used"** — bump happens automatically, but if you uploaded
  a build manually then EAS reused a number, just rebuild; `autoIncrement` fixes it.
- **Build fails on native module** — run a local prebuild to reproduce:
  `npx expo prebuild --platform android --clean`. See
  [the calling docs](../calling/) and project memory for known Android quirks.
- **Data safety rejection** — re-check the Data safety form matches what the app
  actually requests (mic, notifications, account data).
- **Privacy policy rejected** — URL must be public, reachable, and mention the app.

---

## Manual fallback (no EAS) — Android Studio

Only if you can't use EAS. This builds the AAB locally.

```bash
cd boh-mobile
npx expo prebuild --platform android --clean   # generates the android/ project
cd android
./gradlew bundleRelease                         # output: app/build/outputs/bundle/release/app-release.aab
```

You must configure your own signing keystore in `android/app/build.gradle` /
`gradle.properties` first (generate one with `keytool`). Then upload the
`app-release.aab` manually in Play Console (Step 3). EAS is strongly recommended
over this — it manages signing for you.
