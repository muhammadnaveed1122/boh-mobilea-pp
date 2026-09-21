# Firebase config — per environment

Firebase native config files are **bundle-id / package specific**. QA and PROD are
different apps on the device (`com.rhkproperties.mobile.qa` vs `com.rhkproperties.mobile`),
so each needs its OWN config files. `app.config.js` selects the folder by `APP_ENV`.

```
firebase/
  prod/   → com.rhkproperties.mobile      (Firebase project rhk-properties-aa6d0)
  qa/     → com.rhkproperties.mobile.qa   (Firebase project rhk-properties-qa)
```

## Files each folder must contain

- `google-services.json` — Android app config (drives FCM sender + package)
- `GoogleService-Info.plist` — iOS app config

## How to populate `firebase/qa/`

1. Firebase console → create/open the **QA project** `rhk-properties-qa`.
2. Add Android app with package `com.rhkproperties.mobile.qa` → download
   `google-services.json` → drop here.
3. Add iOS app with bundle `com.rhkproperties.mobile.qa` → download
   `GoogleService-Info.plist` → drop here.
4. Cloud Messaging settings → upload the team APNs Auth Key (`.p8`).
5. QA backend uses the QA project's **service account JSON** for FCM sends,
   and sets `apns-topic = com.rhkproperties.mobile.qa` (`.voip` for VoIP pushes).

Without matching files here, an `APP_ENV=qa` build fails with
`No matching client found for package name 'com.rhkproperties.mobile.qa'`.
