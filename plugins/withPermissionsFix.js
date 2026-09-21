/**
 * Two manifest-merger fixes:
 *
 * 1. Strip the `android:maxSdkVersion` cap off WAKE_LOCK.
 *
 *    A transitive AAR declares `WAKE_LOCK maxSdkVersion=25`, so the manifest
 *    merger drops it above API 25 — and Expo's `android.permissions` array does
 *    NOT override an existing entry's `maxSdkVersion`. Without WAKE_LOCK on API
 *    26+ the headless FCM task (`@react-native-firebase/messaging` →
 *    HeadlessJsTaskService.acquireWakeLock) crashes with SecurityException —
 *    i.e. every incoming-call wake when the app is backgrounded/killed.
 *
 *    `tools:remove="android:maxSdkVersion"` forces the merger to emit it
 *    uncapped regardless of any library manifest.
 *
 * 2. Remove the FOREGROUND_SERVICE_MEDIA_PLAYBACK permission + `mediaPlayback`
 *    service that `expo-audio` bundles.
 *
 *    expo-audio's AndroidManifest declares FOREGROUND_SERVICE_MEDIA_PLAYBACK and
 *    an `AudioControlsService` (foregroundServiceType="mediaPlayback"). This app
 *    only plays audio in the foreground (call-recording player, chat voice
 *    notes) — no background playback, no media session. The unused permission
 *    triggers a Google Play "Permissions for Foreground Services" policy
 *    rejection, since in-app foreground playback does not qualify as a Media
 *    Playback FGS use case. `tools:node="remove"` drops both from the merged
 *    manifest. (Microphone FGS is kept — CallKeep VoIP needs it.)
 *
 *    NOTE: if background audio playback is ever added (setAudioModeAsync with
 *    shouldPlayInBackground/staysActiveInBackground), revert this removal and
 *    declare the Media Playback use case in Play Console instead.
 *
 * Runs on every prebuild since `android/` is generated + gitignored.
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const UNCAP = ['android.permission.WAKE_LOCK'];
const REMOVE_PERMISSIONS = ['android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'];
const REMOVE_SERVICES = ['expo.modules.audio.service.AudioControlsService'];
// Android XML namespace URI (an identifier, not a network endpoint).
// eslint-disable-next-line sonarjs/no-clear-text-protocols
const TOOLS_NS = 'http://schemas.android.com/tools';

const withPermissionsFix = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Ensure the `tools:` namespace is declared on <manifest>.
    manifest.$ = manifest.$ ?? {};
    if (!manifest.$['xmlns:tools']) manifest.$['xmlns:tools'] = TOOLS_NS;

    manifest['uses-permission'] = manifest['uses-permission'] ?? [];

    for (const name of UNCAP) {
      let entry = manifest['uses-permission'].find((p) => p?.$?.['android:name'] === name);
      if (!entry) {
        entry = { $: { 'android:name': name } };
        manifest['uses-permission'].push(entry);
      }
      delete entry.$['android:maxSdkVersion'];
      entry.$['tools:remove'] = 'android:maxSdkVersion';
    }

    // Force-remove library-injected permissions from the merged manifest.
    for (const name of REMOVE_PERMISSIONS) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (p) => p?.$?.['android:name'] !== name,
      );
      manifest['uses-permission'].push({
        $: { 'android:name': name, 'tools:node': 'remove' },
      });
    }

    // Force-remove library-injected services from the merged manifest.
    const app = manifest.application?.[0];
    if (app) {
      app.service = app.service ?? [];
      for (const name of REMOVE_SERVICES) {
        app.service = app.service.filter((s) => s?.$?.['android:name'] !== name);
        app.service.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
      }
    }

    return cfg;
  });

module.exports = withPermissionsFix;
