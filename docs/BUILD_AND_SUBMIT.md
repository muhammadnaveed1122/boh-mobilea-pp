# Build & Submit

Local builds for both platforms via `eas build --local`. Submission is **manual**:
iOS through Transporter, Android through Play Console.

QA and PROD are separate apps (own bundle id, Firebase project, signing key,
store listing), selected by the **build profile**.

## Identity

|                     | PROD                        | QA                            |
| ------------------- | --------------------------- | ----------------------------- |
| profile             | `production`                | `production-qa`               |
| bundle id / package | `com.rhkproperties.mobile`  | `com.rhkproperties.mobile.qa` |
| backend             | `api.rhkproperties.com`     | `api-qa.rhkproperties.com`    |
| iOS ASC app         | `6776589860`                | `6786219046`                  |
| distribution        | App Store / Play production | TestFlight / Play internal    |

Apple team `UFYQ4RL447`. Signing (iOS certs + profiles, Android keystore) is
EAS-managed — nothing local to configure.

## Build

```bash
cd boh-mobile

# iOS   → .ipa
npx eas-cli build --local -p ios --profile production --output ./build/rhk-prod.ipa
# Android → .aab
npx eas-cli build --local -p android --profile production --output ./build/rhk-prod.aab
```

Swap `--profile production-qa` for QA builds.

- **No version editing.** `appVersionSource: remote` + `autoIncrement` means EAS
  owns the build number / versionCode and bumps it every build. The
  `android.versionCode` in `app.json` is ignored.
- **Env has two sources, and one is machine-local.** The 10 shared vars live in
  `eas.json` `build.<profile>.env` (committed). Three more —
  `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_LEAD_CONTACT_ENCRYPTION_KEY`,
  `EXPO_PUBLIC_TURN_CREDENTIAL` — exist **only in the gitignored `.env`**. EAS
  stores no environment variables (`eas env:list` is empty for every
  environment), so these reach a build only because `--local` runs the Metro
  bundle step on a machine where `.env` exists.

  **Consequence:** a cloud `eas build`, a fresh clone, or another machine
  produces a build with those three missing — broken Places autocomplete, broken
  TURN relay auth, and a throw in `contact-encryption.ts`. Keep `.env` backed up
  off-machine, or move the three to EAS (`eas env:create --environment
production`, visibility `sensitive` — `EXPO_PUBLIC_*` cannot be `secret`) and
  they stop being machine-local. Verify before uploading with the bundle grep
  below.

- Answer **No** to "log in to your Apple account?" — creds come from EAS.
- Needs ~15 GB free disk and `fastlane` (`brew install fastlane`) for iOS.

## Submit

**iOS — Transporter:** open Transporter, drag in the `.ipa`, Deliver. Appears in
App Store Connect → TestFlight, processing 5–15 min.

**Android — Play Console:** the app → Testing → Internal testing (or Production)
→ Create new release → upload the `.aab` → Start rollout.

## Verify a build before uploading

```bash
# iOS: bundle id, version, push env
unzip -p build/rhk-prod.ipa 'Payload/*.app/Info.plist' > /tmp/i.plist
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' -c 'Print :CFBundleVersion' /tmp/i.plist

# Android: signer must be the EAS upload key Play locked to
# expected SHA1: 45:85:40:8A:6B:93:19:CC:9E:B5:6E:AB:91:43:45:8F:18:62:C2:BD
unzip -p build/rhk-prod.aab 'META-INF/*.RSA' | keytool -printcert | grep -E "Owner:|SHA1:"
```

The three machine-local vars are the easiest thing to ship broken — confirm they
were inlined before you upload:

```bash
# iOS
unzip -p build/rhk-prod.ipa 'Payload/*.app/main.jsbundle' > /tmp/b.js
# Android
unzip -p build/rhk-prod.aab 'base/assets/index.android.bundle' > /tmp/b.js

grep -c "api.rhkproperties.com" /tmp/b.js          # must be > 0
grep -c "api-qa.rhkproperties.com" /tmp/b.js       # must be 0
```

## Gotchas

- **Approved iOS version rejects new builds.** Once a version (e.g. `2.0.7`) is
  approved on the App Store, Apple refuses every further build of it — "Invalid
  Pre-Release Train". Bump `expo.version` in `app.json` and rebuild. Build-number
  bumps do not help.
- **Android upload key is fixed.** Play locked the upload key to the EAS keystore
  (`Build Credentials wPz93d7qET`). Any AAB signed with a different key is
  rejected. Using `eas build` keeps this automatic.
- **Jitsi WebRTC is a 200 MB pod download** on a cold CocoaPods cache and EAS
  kills the build if that phase stalls 30 min. On slow connections, seed the
  cache from an existing copy instead of re-downloading:

  ```bash
  SLUG=124.0.2-$(shasum -a 1 ~/.cocoapods/repos/trunk/Specs/6/3/d/JitsiWebRTC/124.0.2/JitsiWebRTC.podspec.json | cut -c1-5)
  mkdir -p ~/Library/Caches/CocoaPods/Pods/Release/JitsiWebRTC/$SLUG
  ditto ios/Pods/JitsiWebRTC/WebRTC.xcframework \
        ~/Library/Caches/CocoaPods/Pods/Release/JitsiWebRTC/$SLUG/WebRTC.xcframework
  cp ~/.cocoapods/repos/trunk/Specs/6/3/d/JitsiWebRTC/124.0.2/JitsiWebRTC.podspec.json \
     ~/Library/Caches/CocoaPods/Pods/Specs/Release/JitsiWebRTC/$SLUG.podspec.json
  ```

- **`expo doctor` exiting 1 is non-fatal** — the build continues past it.
- **New iOS capability needs one cloud build.** `--local` never syncs Apple
  capabilities. After adding one (Sign In with Apple, associated domains, …), run
  a cloud `eas build -p ios` once to regenerate the provisioning profile, then
  local builds sign again.
- **QA call-service isolation** is server-side, not build config: QA needs its own
  `FCM_SERVICE_ACCOUNT`, `APNS_BUNDLE_ID=com.rhkproperties.mobile.qa`, and
  `APNS_ENV=production` for TestFlight builds.

## Reference

```text
iOS      eas build --local -p ios     --profile production      → Transporter
Android  eas build --local -p android --profile production      → Play Console
QA       same, --profile production-qa
Debug APK (sideload, no keystore):  npx expo prebuild -p android && cd android && ./gradlew assembleDebug
Check/reset EAS version counter:    eas build:version:get|set -p <platform> --profile production
```
