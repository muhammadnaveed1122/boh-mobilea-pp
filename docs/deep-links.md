# Deep links (Universal Links / App Links)

Tapping `https://rhkproperties.com/my-account/manage-leads/<leadId>` opens that lead inside the app
when it is installed, and falls back to the website when it is not. No custom scheme is shown to the
user and nothing breaks for people without the app.

## How the OS decides

Both platforms run the same two-way handshake. The app declares the domain, the domain declares the
app, and links are only routed into the app when **both** sides agree:

| Side      | iOS                                       | Android                                      |
| --------- | ----------------------------------------- | -------------------------------------------- |
| App says  | `ios.associatedDomains` in `app.json`     | `android.intentFilters` (`autoVerify: true`) |
| Site says | `/.well-known/apple-app-site-association` | `/.well-known/assetlinks.json`               |

Both files are served by **boh-lead-magnet** from `src/app/.well-known/*/route.ts`, generated from
`src/constants/mobileAppLinks.ts`. They are public by design — bundle ids, team ids and certificate
fingerprints are all readable from any published build. They identify the app; they do not authorize
anything. The private signing key is what proves ownership and it never appears there.

## Path translation

The website and the app disagree on route shape (`/my-account/manage-leads/:id` vs `/leads/:id`), so
every incoming URL passes through [`app/+native-intent.ts`](../app/+native-intent.ts) →
[`src/lib/deep-links.ts`](../src/lib/deep-links.ts) before Expo Router matches it.

The path table is **not** duplicated there: it reuses
`src/features/notifications/utils/resolve-redirect.ts`, which already maps these same backend web
routes for push-notification taps. One table, so a link and a notification can never drift apart.

A link that arrives while the session is still loading (cold start) or while the user is signed out
would otherwise be lost to the `(app)` auth gate's redirect to `/login`. `src/lib/pending-link.ts`
parks the destination, and `app/(auth)/_layout.tsx` — which already owns the "you are authenticated,
go to `/`" redirect — sends the user there instead. Keeping it to that one redirect is deliberate: a
second navigation racing the auth layout's could drop the user on the home tab instead of the lead.

## Scope

Only `/my-account/manage-leads/*` is claimed. A `/*` claim would hand the app every URL on the
domain — auth flows, payments, anything added later. Widening it means changing **both**
`android.intentFilters` here and `MOBILE_LINK_PATH_PREFIX` in boh-lead-magnet.

The lead id in the URL is an identifier, not a permission: the lead screen must still authorize
against the backend, because links get forwarded.

## QA builds are excluded on purpose

`app.config.js` strips `associatedDomains` and `intentFilters` for any non-production `APP_ENV`. The
association files name the production bundle id and its signing certificate only, so the QA app could
never pass verification anyway — and on iOS the `associatedDomains` entitlement requires the
Associated Domains capability on the App ID, so leaving it on `com.rhkproperties.mobile.qa` would
break QA provisioning-profile generation.

Consequence: **deep links can only be tested on a production-identity build.** If QA ever needs them,
give it a subdomain (e.g. `qa.rhkproperties.com`) and claim that host under `APP_ENV=qa`.

## Before this works in production

1. **Play App Signing fingerprint.** Play re-signs uploaded bundles, so a Play-installed APK carries
   Google's certificate, not the upload key. Copy the SHA-256 from Play Console → Test and release →
   Setup → App integrity → App signing key certificate, and set it as `ANDROID_APP_SIGNING_SHA256` in
   the boh-lead-magnet production environment. Without it, App Links verification fails for every
   store install. (The upload key fingerprint is already committed, which covers sideloaded release
   APKs.)
2. **Deploy the website first.** The association files must be live before an app build that declares
   the domains reaches users, otherwise verification fails on install and Android will not retry
   until the next verification pass.
3. **iOS capability.** Associated Domains must be enabled on the `com.rhkproperties.mobile` App ID.
   EAS does this when it regenerates the provisioning profile for a build that carries the
   entitlement; if a build fails on the profile, run `eas credentials` for iOS and let it re-sync.

## Verifying

Website (works from any machine once deployed):

```bash
curl -sI https://rhkproperties.com/.well-known/apple-app-site-association   # 200, application/json
curl -s  https://rhkproperties.com/.well-known/assetlinks.json | jq
```

Android, on a device with the production build installed:

```bash
adb shell pm get-app-links com.rhkproperties.mobile          # want: rhkproperties.com: verified
adb shell pm verify-app-links --re-verify com.rhkproperties.mobile   # force a re-check
```

iOS: Apple serves the association file through its own CDN
(`app-site-association.cdn-apple.com`), cached up to 24h, so edits take that long to reach devices.
While developing, append `?mode=developer` to the `applinks:` entries in `app.json` to bypass the CDN.

On both platforms, test by tapping a link from **another app** (WhatsApp, Messages, Notes). Typing
the URL into the browser address bar deliberately does not open the app.
