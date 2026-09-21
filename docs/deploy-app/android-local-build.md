# Build the Android AAB Locally (no EAS cloud)

Step-by-step guide to build a **signed production `.aab` on your own Mac** with
Gradle, instead of waiting on the EAS cloud queue. The output uploads to the same
Play Store track and is interchangeable with EAS builds (same signing key).

Use this when you want a fast build (no queue) or to bake local `.env` values into
the app. For the cloud path see [android-play-store.md](android-play-store.md).

> Why we set this up: an EAS cloud build shipped with a broken API because the
> `EXPO_PUBLIC_*` env vars were not configured in the EAS environment, so the app
> fell back to `http://localhost:3000` (see [`src/lib/config.ts`](../../src/lib/config.ts)).
> A **local** build inlines the values from your local `.env` automatically, which
> is the simplest fix.

---

## Quick rebuild (TL;DR)

```bash
cd boh-mobile

# 1. Bump versionCode (must be > last uploaded) in app.json -> expo.android.versionCode
# 2. Confirm .env has the right API URL (no leading #):
grep '^EXPO_PUBLIC_API_BASE_URL' .env        # want api-qa or api (prod), NOT localhost

# 3. Build
cd android && ./gradlew bundleRelease --no-daemon
```

Output: `android/app/build/outputs/bundle/release/app-release.aab` → upload to Play Console.

> **Signing is now automatic.** The `plugins/withAndroidSigning.js` config plugin
> re-injects the keystore (from gitignored `.secrets/`), the `release` signingConfig,
> and the `gradle.properties` secrets on **every** `expo prebuild` — no more manual
> Steps 1–3 or `eas credentials` re-download after a prebuild wipe. `versionCode`
> comes from `app.json` (`expo.android.versionCode`), so prebuild no longer resets
> it to 1. Steps 1–3 below are kept only as a reference / first-time setup on a new
> machine (where you must populate `.secrets/release.keystore` + `.secrets/keystore.json`).

<!-- -->

> **Changed `.env` (e.g. qa → prod) but only edited `.env`?** Gradle does NOT treat
> `.env` as a build input, so the JS bundle task goes `UP-TO-DATE` and silently
> reuses the OLD env. Force a fresh bundle first:
>
> ```bash
> rm -rf android/app/build/generated/assets/createBundleReleaseJsAndAssets \
>        android/app/build/intermediates/assets/release "$TMPDIR"/metro-* node_modules/.cache
> ```
>
> Then build. Always re-run the Verify block to confirm the right URL is baked.

### If `android/` was wiped (versionCode reset to 1, no `release.keystore`)

An `expo prebuild --clean` nukes the native folder + signing. Restore before building:

```bash
cd boh-mobile

# a. SDK path
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties

# b. Re-add the release signingConfig in android/app/build.gradle (see Step 3b below).

# c. Download the EAS upload keystore (interactive — prints 3 secrets):
eas credentials      # Android -> production -> Keystore: Manage everything -> Download Keystore
mv <downloaded>.jks android/app/release.keystore

# d. Wire secrets into android/gradle.properties (gitignored):
cat >> android/gradle.properties <<'EOF'
RELEASE_STORE_FILE=release.keystore
RELEASE_KEY_ALIAS=<key alias>
RELEASE_STORE_PASSWORD=<keystore password>
RELEASE_KEY_PASSWORD=<key password>
EOF

# e. Bump versionCode, then build (Quick rebuild above).
```

### Verify (optional)

```bash
AAB=android/app/build/outputs/bundle/release/app-release.aab
keytool -printcert -jarfile "$AAB" | grep SHA1     # = 45:85:40:8A:6B:93:19:CC:9E:B5:6E:AB:91:43:45:8F:18:62:C2:BD
unzip -p "$AAB" base/assets/index.android.bundle > /tmp/b.js
grep -ac 'api-qa.rhkproperties.com' /tmp/b.js      # want 1+
grep -ac 'localhost:3000' /tmp/b.js                # want 0
```

---

## How env vars reach the app (important mental model)

- Only vars prefixed **`EXPO_PUBLIC_`** are inlined into the JS bundle at build time.
- The Gradle release task runs Expo's bundler (`expo export:embed`), which loads
  `.env` from the project root automatically. So **whatever is in `.env` when you
  run `./gradlew bundleRelease` gets baked in.**
- [`src/lib/config.ts`](../../src/lib/config.ts) reads `EXPO_PUBLIC_API_BASE_URL`;
  if missing in a production build it falls back to `http://localhost:3000` (dead
  on a real phone). Always confirm `.env` has the right URL before building.

```bash
# .env (project root) — example
EXPO_PUBLIC_API_BASE_URL=https://api-qa.rhkproperties.com
EXPO_PUBLIC_SOCKET_URL=https://api-qa.rhkproperties.com
# ...google keys, encryption key, etc.
```

Switch qa → prod by editing `.env`, then rebuild. No code change.

---

## One-time setup

You only do Steps 1–3 once. After that, building is just Step 4–5.

### Prerequisites (already installed on the current Mac)

| Tool        | Check                                          | Notes                           |
| ----------- | ---------------------------------------------- | ------------------------------- |
| JDK 17      | `java -version` → `17.x`                       | `JAVA_HOME` must point at it    |
| Android SDK | `echo $ANDROID_HOME` → `~/Library/Android/sdk` | `adb` on PATH                   |
| Node 24     | `node -v` → `v24.x`                            | matches the pnpm 11 requirement |
| pnpm 11     | `pnpm -v`                                      | `pnpm install` already run      |

### Step 1 — `android/local.properties`

Points Gradle at the SDK. One line (the `android/` folder is gitignored):

```bash
printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
```

### Step 2 — Get the release signing keystore

**Critical:** the app on Play is locked to the **EAS upload keystore**. A local
build MUST sign with that exact keystore, or Play rejects the upload
("the Android App Bundle was signed with the wrong key"). Do **not** generate a
new one and do **not** use the debug keystore.

Download the EAS keystore:

```bash
eas credentials
# → select: Android
# → Production
# → Keystore: Manage everything needed to build your project
# → Download Keystore
```

This saves a `.jks`/`.keystore` file and prints the **keystore password**,
**key alias**, and **key password**. Move the file into the app module:

```bash
mv <downloaded-file>.jks android/app/release.keystore
```

> Keep the three secrets safe (password manager). They are the keys to shipping
> updates. On this machine they are already wired into `android/gradle.properties`
> (Step 3) — that file is gitignored, so the secrets are never committed.

### Step 3 — Wire signing into Gradle

Two edits. Both live inside the gitignored `android/` folder, so no secrets reach
git.

**a) `android/gradle.properties`** — append (use the real values from Step 2):

```properties
# --- Release signing (EAS upload keystore, com.rhkproperties.mobile) ---
# android/ is gitignored so these secrets are NOT committed. Do not commit.
RELEASE_STORE_FILE=release.keystore
RELEASE_KEY_ALIAS=<key alias>
RELEASE_STORE_PASSWORD=<keystore password>
RELEASE_KEY_PASSWORD=<key password>
```

**b) [`android/app/build.gradle`](../../android/app/build.gradle)** — add a
`release` signing config and point the `release` build type at it. The guard means
the build still works (falls back to debug) if the props are absent:

```gradle
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        if (project.hasProperty('RELEASE_STORE_FILE')) {
            storeFile file(RELEASE_STORE_FILE)
            storePassword RELEASE_STORE_PASSWORD
            keyAlias RELEASE_KEY_ALIAS
            keyPassword RELEASE_KEY_PASSWORD
        }
    }
}
buildTypes {
    debug {
        signingConfig signingConfigs.debug
    }
    release {
        signingConfig project.hasProperty('RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug
        // ...existing shrink/minify/proguard lines stay unchanged...
    }
}
```

---

## Every build

### Step 4 — Bump the versionCode

**Play requires a strictly higher `versionCode` than any build already uploaded.**
EAS auto-increments this remotely; **local Gradle does not** — you edit it by hand.

In [`android/app/build.gradle`](../../android/app/build.gradle) (`defaultConfig`):

```gradle
versionCode 6        // was 5 — bump by 1 every upload
versionName "1.0.0"  // user-facing; bump when you want a new public version
```

> Forgetting this → Play error "Version code N has already been used." Just bump
> and rebuild.

### Step 5 — Build

```bash
cd android
./gradlew bundleRelease --no-daemon
```

First build ~7 min (cold cache); later builds ~30s. Output:

```
android/app/build/outputs/bundle/release/app-release.aab
```

### Step 6 — Verify before uploading (optional but recommended)

```bash
AAB=android/app/build/outputs/bundle/release/app-release.aab

# Signed with the right key? SHA1 must match the EAS keystore.
keytool -printcert -jarfile "$AAB" | grep SHA1

# Correct env baked in? Should print the URL, and 0 for localhost.
unzip -p "$AAB" base/assets/index.android.bundle | strings | grep -c "api-qa.rhkproperties.com"
unzip -p "$AAB" base/assets/index.android.bundle | strings | grep -c "localhost:3000"
```

### Step 7 — Upload

Play Console → **Internal testing** (or Production) → **Create new release** →
**Upload** the `.aab` → release notes → **Save and publish**. Internal testing is
live in minutes (no Google review). See
[android-play-store.md](android-play-store.md) for the listing/Data-safety steps
required before Production.

---

## Gotchas (learned the hard way)

- **Wrong signing key → Play rejects.** Always sign with the EAS upload keystore
  (Step 2). Verify with `keytool -printcert -jarfile` before uploading.
- **versionCode must increase every upload** (Step 4). Local Gradle won't do it
  for you.
- **`expo prebuild --clean` wipes `android/`** — including `local.properties`,
  the keystore, the `gradle.properties` secrets, and the `build.gradle` signing
  edits. This is a managed Expo project, so a prebuild regenerates the native
  folder from scratch. If you ever run it, **redo Steps 1–4**. (To make signing
  survive prebuilds permanently, move it into a config plugin under `plugins/` —
  not done yet.)
- **`.env` is the source of API config.** Wrong URL in `.env` → wrong URL in the
  app. There is no separate production env file; edit `.env` before building.
- **iOS local builds need a Mac + Xcode** and are more involved (certificates,
  provisioning). For iOS, EAS cloud is still the easy path — see
  [apple-app-store.md](apple-app-store.md).

---

## When to use cloud (EAS) instead

- You need an **iOS** build and don't want to manage Xcode signing.
- You want EAS to **auto-increment versionCode** and manage credentials.
- The fix is env-only: add the vars to the EAS environment and rebuild in the
  cloud (`eas env:create --environment production --name EXPO_PUBLIC_API_BASE_URL
--value https://api-qa.rhkproperties.com`, repeat per var) — then no local
  signing work is needed.
