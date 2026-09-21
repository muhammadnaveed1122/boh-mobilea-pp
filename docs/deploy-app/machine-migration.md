# Moving to a new development machine

Goal: after the wipe, log back into the accounts, clone the repos, restore one encrypted
archive — and every store release (App Store + Play) still builds and signs identically.

Audited 2026-07-27 across the whole `boh/` umbrella. Facts below were verified on this
machine, not assumed.

---

## 1. What is already safe

| Thing                                               | Lives on                                                                               | Why it survives                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| All source (6 repos)                                | Azure DevOps / GitHub                                                                  | Verified: 0 uncommitted, 0 unpushed commits in every repo               |
| iOS distribution certificate + private key          | EAS servers                                                                            | EAS-managed since the first cloud build; `eas credentials` re-downloads |
| iOS provisioning profiles                           | EAS servers                                                                            | Regenerated on demand; also disposable                                  |
| APNs push key `UD84C7LGRZ`                          | EAS servers                                                                            | Uploaded once, shared by boh-mobile prod/qa + OWNRS                     |
| App Store Connect API key (submit)                  | EAS servers                                                                            | No local `.p8` exists — `eas submit` pulls it server-side               |
| Sign in with Apple key                              | Backend `APPLE_PRIVATE_KEY` in Azure Key Vault                                         | Backend-only concern, not a build credential                            |
| Play **App Signing** key                            | Google                                                                                 | Google holds the key that actually signs installs                       |
| FCM V1 service-account keys                         | EAS servers (+ regenerable from Firebase)                                              | New JSON can be minted any time                                         |
| `google-services.json` / `GoogleService-Info.plist` | Committed — `boh-mobile/firebase/{qa,prod}/`, `boh-owners-mobile/google-services.json` | Clones with the repo                                                    |
| FreeSWITCH certs                                    | Committed in `communication-service`                                                   | Clones with the repo                                                    |
| Backend production secrets                          | Azure Key Vault                                                                        | Pipelines read them, not this Mac                                       |

Everything in that table is reachable with **account logins alone**. Nothing to copy.

## 2. What exists ONLY on this Mac

These are gitignored, so a fresh clone does **not** contain them.

| File                                                                                    | Why it matters                                                                                                                                                                                            | Recoverable without the backup?                                   |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `boh-mobile/.secrets/release.keystore` + `keystore.json`                                | **Play upload key** for `com.rhkproperties.mobile`. Wrong key ⇒ Play rejects every upload.                                                                                                                | Yes _if_ EAS still holds it — verify in §3.1 before trusting this |
| `boh-mobile/.secrets/qa/release.keystore` + `qa/keystore.json`                          | Same for the QA build (alias `rhk-qa-upload`)                                                                                                                                                             | Same — verify                                                     |
| `boh-mobile/.env`                                                                       | Local dev API/keys                                                                                                                                                                                        | No                                                                |
| `boh-owners-mobile/.env`                                                                | Local dev API/keys, Maps key                                                                                                                                                                              | No                                                                |
| `boh-lead-magnet/.env`                                                                  | Web frontend dev env                                                                                                                                                                                      | No                                                                |
| `boh-lead-magnet-backend/.env`                                                          | Backend dev env (DB URL, JWT, Apple/Google keys)                                                                                                                                                          | Partly — prod values are in Key Vault, dev values are not         |
| `boh-mobile/android/app/debug.keystore`, `boh-owners-mobile/android/app/debug.keystore` | Their SHA-1s are registered as Android OAuth clients in Google Cloud project `767292126416`. A new machine generates a **new** debug keystore ⇒ Google Sign-In dies with `DEVELOPER_ERROR` in dev builds. | Only by registering the new SHA-1 in Google Cloud                 |

`boh-owners-mobile/.secrets/` is empty (no Play service-account key created yet) and that
project has **zero EAS builds ever** — OWNRS is not on either store, so it has no signing
history to preserve. Only its `.env` matters.

## 3. Do this BEFORE wiping

### 3.1 Prove EAS really holds the Android keystores

This is the only item that is unrecoverable if both copies vanish. `eas credentials` is
interactive — run it and look, do not assume.

```bash
cd boh-mobile
APP_ENV=production eas credentials -p android   # → production → Keystore: Manage everything
APP_ENV=qa         eas credentials -p android   # same for the QA project
```

Expect an existing keystore with a SHA-1 and a **Download Keystore** option. Download both;
EAS prints the store/key passwords at download time. Put the `.jks` + passwords in the
password manager.

- If a project shows **no keystore**, the local `.secrets/` copy is the only one in
  existence — back it up in two places and re-upload it to EAS.
- Also confirm **Play Console → Test and release → Setup → App signing** shows Play App
  Signing enabled. With it enabled, a lost _upload_ key can be reset by Google support; the
  release key itself is never at risk. Without it, a lost keystore ends the app's update path.

Do the same read-only sweep for iOS so there are no surprises later:

```bash
APP_ENV=production eas credentials -p ios       # dist cert, profile, push key, ASC API key
```

### 3.2 Back up the local-only files

```bash
cd ~/Desktop/Projects/boh
tar -czf - \
  boh-mobile/.env boh-mobile/.secrets boh-mobile/android/app/debug.keystore \
  boh-owners-mobile/.env boh-owners-mobile/android/app/debug.keystore \
  boh-lead-magnet/.env boh-lead-magnet-backend/.env \
| openssl enc -aes-256-cbc -pbkdf2 -salt -out ~/boh-secrets-$(date +%Y%m%d).tar.gz.enc
```

Restore on the new machine:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -in boh-secrets-YYYYMMDD.tar.gz.enc \
| tar -xzf - -C ~/Desktop/Projects/boh
```

Store the archive somewhere that is not this laptop and not a plain cloud folder — password
manager attachment, or an encrypted drive. It contains signing keys and API keys.

### 3.3 Secure the account logins — the real single points of failure

Every credential in §1 is behind one of these. Losing account access is worse than losing
the Mac.

| Account                                                | Used for                                    | Check before wiping                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Expo `rhkdev` (`tajumal.hussain@ahksolution.com`)      | **All build/signing credentials**           | Password saved; 2FA recovery codes saved                                                                                                  |
| Apple Developer / App Store Connect, team `UFYQ4RL447` | Certs, profiles, keys, TestFlight, releases | **A trusted phone number is registered.** This Mac is a trusted device — wiping it without a trusted phone can lock you out of 2FA        |
| Google Play Console                                    | Play releases, App Signing                  | Access + 2FA                                                                                                                              |
| Google Cloud project `767292126416`                    | OAuth clients (Google Sign-In), Maps key    | Access                                                                                                                                    |
| Firebase (`rhk-properties`, `rhk-properties-aa6d0`)    | FCM keys, `google-services.json`            | Access                                                                                                                                    |
| Azure DevOps (AHKSolution) + GitHub (RHK-Properties)   | The repos themselves                        | No SSH keys exist here — git runs over HTTPS with credentials in the macOS keychain, so the new machine needs a fresh PAT / browser login |
| Azure Key Vault (QA + prod)                            | Backend production secrets                  | Access                                                                                                                                    |

Apple `.p8` keys download **once** and the team is capped at 2 APNs keys — never "just
recreate" one without checking what still uses the old key.

## 4. New machine bring-up

```bash
# tooling
xcode-select --install                 # then Xcode from the App Store + open it once
sudo gem install cocoapods             # or brew
brew install fastlane                  # only needed for `eas build --local`
# node 24.15.0 (pinned in eas.json), pnpm 11.0.5 (pinned in package.json)
corepack enable
pnpm add -g eas-cli@latest             # never `npm i -g` / sudo — pnpm owns global CLIs here

# accounts
eas login                              # expect: rhkdev

# code
git clone <azure>/boh-mobile && git clone <azure>/boh-owners-mobile   # + the other 4 repos

# secrets
# restore the §3.2 archive, then per repo:
#   boh-mobile / boh-owners-mobile → pnpm install
#   boh-lead-magnet-backend        → npm install   (npm, NOT pnpm — pnpm wrecks node_modules there)
```

Then, before the first dev build: register the restored debug keystore's SHA-1 — or the new
machine's, if you skipped that file — as an Android OAuth client in Google Cloud project
`767292126416`, package `com.rhkproperties.mobile` / `com.rhkproperties.owners`.

## 5. Verify the migration worked

Signing correctness is only proven by a real build.

```bash
cd boh-mobile
APP_ENV=production eas build -p ios     --profile production --non-interactive
APP_ENV=production eas build -p android --profile production --non-interactive
```

- iOS: submit to TestFlight and confirm the build appears in App Store Connect.
- Android: upload the AAB to the **internal** track first. Play rejects a wrong signing key
  at upload — that rejection is the test. Only promote after it is accepted.
- Compare the AAB's SHA-1 against the keystore EAS handed you if you want the check before
  upload: `keytool -list -v -keystore <downloaded>.jks` vs Play Console → App signing →
  upload key certificate.
