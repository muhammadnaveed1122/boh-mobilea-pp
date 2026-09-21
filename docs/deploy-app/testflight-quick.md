# TestFlight — Quick Deploy (next build)

Cheatsheet for shipping a new iOS build to TestFlight. Full first-time guide:
[`apple-app-store.md`](./apple-app-store.md). One-time setup (Apple membership, certs,
ASC app, API key) is already done — this is the repeat loop.

App: `RHK Properties` · bundle `com.rhkproperties.mobile` · team `UFYQ4RL447` ·
EAS project `rhkdev/rhk-properties`.

---

## The loop

```bash
cd boh-mobile

# 1. Commit your changes FIRST — EAS builds from the git commit, not the working dir.
git add -A && git commit -m "..."        # uncommitted changes WON'T be in the build

# 2. Build the IPA in the cloud (~15-25 min). Certs are stored → no Apple prompts.
eas build --platform ios --profile production --non-interactive

# 3. Upload to TestFlight. ascAppId is wired into eas.json → fully non-interactive.
eas submit --platform ios --profile production --latest --non-interactive
```

Then on the iPhone: open **TestFlight** app → pull to refresh → tap **Update**.

---

## Notes

- **Build number auto-increments** (eas.json `autoIncrement` + `appVersionSource: remote`).
  3 → 4 → 5… automatically. Don't touch it.
- **Version** (`1.0.0`) only changes when you bump `expo.version` in `app.json` — needed
  for a new App Store release, NOT for TestFlight.
- **`1.0.0 (4)`** means version 1.0.0, **build 4**. Higher build number = newer.
- After submit, ASC shows the build as **Processing** (yellow, 5-15 min) → **Complete**
  (green). It only appears on the iPhone once it's green.
- **ascAppId is now set** (`6776589860`) in eas.json `submit.production.ios`, so submit
  runs non-interactive. The App Store Connect API key (ID `KX88ZT2QLK`) lives on EAS
  servers — no `.p8` needed locally.
- If submit prints **"Something went wrong when submitting"** right after **"Scheduled
  iOS submission"**, the IPA usually still delivered — check **Build Uploads** in ASC
  before resubmitting. Resubmitting the same build number errors as a duplicate.
- **Icon-path gotcha:** iOS icon is `./assets/AppIcon.icon` (Icon Composer bundle);
  top-level icon/splash/favicon use `./assets/icons/icon.png`; Android adaptive uses
  `./assets/icons/adaptive-*.png`. All must be **committed** — if any referenced icon is
  missing, iOS prebuild fails with `ENOENT` and the EAS build errors at the Prebuild
  phase. Catch it early with a local
  `EXPO_PLATFORM=ios npx expo prebuild --platform ios --clean --no-install`.

## Build locally on a Mac (faster, free, no cloud queue)

Needs **fastlane** (`brew install fastlane`) plus Xcode + CocoaPods. Reuses EAS
signing creds and the same `production` profile env (still NOT `.env`).

```bash
eas build  --platform ios --profile production --local --output ./build/rhk-prod.ipa
eas submit --platform ios --profile production --path ./build/rhk-prod.ipa --non-interactive
```

Watch free disk — an iOS compile + DerivedData wants ~10-20 GB. The temp signing
keychain is created and auto-destroyed by the build.

## Why eas.json env, not .env

EAS **cloud** builds clone the git commit on a remote machine; `.env` is gitignored
so it never gets there. Cloud builds read vars only from eas.json
`build.production.env` (committed) or **EAS env vars** (`eas env:create`, off-git —
the right place for secrets). `eas build --local` also uses the eas.json profile env,
not `.env`. To change the prod API URL etc., edit eas.json — editing `.env` does
nothing for a production build.

## GoogleSignIn pod-install failure (modular_headers)

If Install pods fails with _"The Swift pod `AppCheckCore` depends upon
`GoogleUtilities` and `RecaptchaInterop`, which do not define modules"_ — that's the
GoogleSignIn pod under static linking. Fixed in app.json `expo-build-properties`
`ios.extraPods` with `modular_headers: true` for those two pods. Already in place;
don't remove it.

## Verify build status from terminal

```bash
eas build:list --platform ios --limit 2 --non-interactive
```

## Add testers

App Store Connect → app → **TestFlight** tab.

- **Internal** (team, instant, no review): add them in **Users and Access** first, then
  the internal group → Testers → **+**.
- **External** (anyone, needs one-time Beta Review ~1 day): External Testing group →
  add by email or enable **Public Link**.
