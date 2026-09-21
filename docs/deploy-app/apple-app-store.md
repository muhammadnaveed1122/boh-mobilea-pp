# Deploy to Apple App Store — Beginner Guide (iOS)

Step-by-step, beginner-friendly guide to get **RHK Properties** onto the Apple App
Store. It assumes you have never published an iOS app before.

We use **EAS** (Expo Application Services) to build in the cloud and upload to
Apple. **Big advantage: you do NOT need a Mac or Xcode** — EAS builds on Apple
machines for you. A manual fallback (Xcode, Mac-only) is at the bottom.

App facts you'll reuse:

| Thing                 | Value                             |
| --------------------- | --------------------------------- |
| App name              | RHK Properties                    |
| iOS bundle identifier | `com.rhkproperties.mobile`        |
| Apple Team ID         | `UFYQ4RL447` (RHK Properties LLC) |
| EAS project           | `rhkdev/rhk-properties`           |
| Store output format   | **IPA** (built by EAS)            |

> iOS note specific to this app: Firebase is stripped on iOS builds (calling/push
> on iOS uses APNs, not Firebase). This is handled automatically by
> [`app.config.js`](../../app.config.js) — you don't do anything. Just build for
> iOS normally and the right config is applied.

---

## 0. One-time accounts you need

1. **Apple Developer Program membership** — costs **$99/year**.
   - Enroll at https://developer.apple.com/programs/enroll/ using the company
     Apple ID. This app's team is **RHK Properties LLC** (Team ID `UFYQ4RL447`),
     so use the Apple ID that belongs to that team, or get invited to it.
   - Enrollment can take 24–48h (Apple may verify the business — D-U-N-S number for
     an LLC). Do this first.
2. **Expo account** — free, already set up (`rhkdev`):
   ```bash
   npx eas login
   ```
3. **Project installed locally:**
   ```bash
   cd boh-mobile
   pnpm install
   ```

You do NOT need to manually create certificates or provisioning profiles. EAS
generates and manages them when you log in with your Apple ID during the build.

---

## 1. Create the app in App Store Connect

App Store Connect (https://appstoreconnect.apple.com) is Apple's web dashboard
(the iOS equivalent of Play Console).

1. First, register the **App ID / bundle identifier** if it doesn't exist:
   - Easiest: let **EAS do it automatically** during the first build (Step 2). It
     registers `com.rhkproperties.mobile` for you. Skip to Step 2 if unsure.
   - Manual way: https://developer.apple.com/account → Certificates, IDs & Profiles
     → Identifiers → **+** → App IDs → bundle ID `com.rhkproperties.mobile` →
     enable **Push Notifications** capability (this app uses push).
2. In **App Store Connect** → **Apps** → **+** → **New App**:
   - Platform: **iOS**
   - Name: `RHK Properties` (must be unique across the whole App Store)
   - Primary language: English (US)
   - Bundle ID: pick `com.rhkproperties.mobile` from the dropdown
   - SKU: any internal id, e.g. `rhk-properties-ios`
   - User access: Full
   - **Create**.

---

## 2. Build the production IPA with EAS

From `boh-mobile`:

```bash
npx eas build --platform ios --profile production
```

What happens:

- EAS asks you to **log in with your Apple ID** (the one on team `UFYQ4RL447`).
- It then **automatically creates** the Distribution Certificate and Provisioning
  Profile and stores them. Answer **Yes** to the prompts to let it manage these.
- Build runs in the cloud (~15–25 min). You get a watch URL.
- Output: a signed **`.ipa`** file.

> Check progress: `npx eas build:list`.
>
> If it asks about the Apple Team and shows `UFYQ4RL447 — RHK Properties LLC`,
> that's correct — pick it.

---

## 3. Upload the build to App Store Connect

Use EAS Submit — easiest path, no Mac needed:

```bash
npx eas submit --platform ios --profile production --latest
```

- First time, EAS needs to authenticate to Apple. Two options it offers:
  - **App Store Connect API key** (recommended) — create one at App Store Connect →
    **Users and Access → Integrations → App Store Connect API → +**. Give it
    "App Manager" access, download the `.p8` file (you can only download once!),
    note the Key ID and Issuer ID. Provide these to EAS when prompted.
  - **Apple ID + app-specific password** — simpler but less robust.
- EAS uploads the IPA to App Store Connect. It then appears under your app's
  **TestFlight** tab after Apple finishes processing (~5–15 min).

---

## 4. Test with TestFlight first (recommended)

Before going live, test the real build via **TestFlight** (Apple's beta system):

1. App Store Connect → your app → **TestFlight** tab.
2. Your uploaded build shows as "Processing", then ready.
3. Apple may require **Export Compliance** answers (encryption): this app uses
   standard HTTPS/encryption only → usually answer "No" to the "do you use
   non-exempt encryption" question (confirm with whoever owns compliance).
4. Add yourself/testers under **Internal Testing** → they install the TestFlight
   app on iPhone and get the build. No App Review needed for internal testers.

Fix anything, rebuild (Step 2), resubmit (Step 3), retest.

---

## 5. Fill the App Store listing (required before review)

App Store Connect → your app → **App Store** tab → the version (e.g. `1.0`):

1. **Screenshots** — REQUIRED. At minimum, screenshots for a **6.7" iPhone**
   (e.g. iPhone 15/16 Pro Max, 1290×2796). Take them from a running build or the
   simulator. Apple is strict about sizes.
2. **Promotional text / Description / Keywords / Support URL / Marketing URL.**
3. **App icon** — already bundled in the build (1024×1024 is auto-extracted). No
   separate upload needed for iOS.
4. **Privacy Policy URL** — REQUIRED, must be public.
5. **App Privacy** (left sidebar → App Privacy) — declare data collection, like
   Android's Data safety. This app collects account info, uses the **microphone**
   (calls), and sends **push notifications**. Be accurate.
6. **Age rating** — fill the questionnaire.
7. **Pricing and Availability** — set to Free, pick countries.
8. Under **Build**, click **+** / **Select a build** and choose the TestFlight
   build you uploaded.
9. **Sign-in info for review** — Apple reviewers need to log in. Provide a **demo
   account** (test email + password) in the "App Review Information" section, or
   the app will be rejected because reviewers can't get past login.

---

## 6. Submit for review

1. On the version page → **Add for Review** / **Submit for Review**.
2. Answer the final questions (export compliance, advertising identifier — this app
   doesn't use IDFA/ads, answer No unless that changes).
3. Submit. Apple review typically takes **1–3 days**.
4. You get email updates. If rejected, Apple tells you why in **Resolution Center**
   — fix and resubmit.
5. Once approved, choose **automatic** or **manual** release to go live.

---

## 7. Updating the app later

1. Bump `expo.version` in [`app.json`](../../app.json) (e.g. `1.0.0` → `1.0.1`).
   The iOS build number auto-increments via EAS (`autoIncrement: true` in
   [`eas.json`](../../eas.json)), so you don't manage it.
2. Build + submit:
   ```bash
   npx eas build --platform ios --profile production
   npx eas submit --platform ios --profile production --latest
   ```
3. In App Store Connect, create a **new version** (e.g. `1.0.1`), attach the new
   build, fill "What's New", submit for review.

Credentials and the API key are remembered after the first setup, so updates are
just the two commands above plus the version form.

---

## Common rejection reasons (avoid these)

- **No demo account** for reviewers behind a login wall → always provide one.
- **Privacy/Data declaration mismatch** — App Privacy must match what the app
  actually does (mic, notifications, account data).
- **Broken privacy policy URL** — must be public and reachable.
- **Crashes on launch / on the reviewer's device** — test via TestFlight first.
- **Permission strings unclear** — iOS shows the usage strings from
  [`app.json`](../../app.json) `infoPlist`/plugin permission prompts; make sure the
  microphone and photos descriptions explain _why_.

---

## Manual fallback (no EAS) — Xcode (Mac only)

Only if you can't use EAS, and only on a Mac with Xcode installed.

```bash
cd boh-mobile
EXPO_PLATFORM=ios npx expo prebuild --platform ios --clean   # generates the ios/ project
npx pod-install                                              # installs CocoaPods
open ios/RHKProperties.xcworkspace                           # open in Xcode (use the .xcworkspace, not .xcodeproj)
```

In Xcode: select a real device / "Any iOS Device", set the Team to
**RHK Properties LLC (UFYQ4RL447)**, then **Product → Archive** → **Distribute App
→ App Store Connect → Upload**. Then continue from Step 4 (TestFlight) above. EAS is
strongly recommended over this — it handles certificates and needs no Mac.
