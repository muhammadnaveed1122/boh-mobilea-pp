/**
 * Microphone permission — React Native replacement for web `useMicrophone`.
 *
 * Returns the same `{ granted, denied, prompt }` shape the brain expects so
 * the ported makeCall/answerCall permission branches port unchanged.
 *
 * - Android: `PermissionsAndroid` gives a real pre-check (and request).
 * - iOS: there is no silent pre-check; calling `getUserMedia` shows the system
 *   prompt (string from Info.plist). We report `prompt` so the brain attempts
 *   `getUserMedia`, and surface the permanent-denial modal if it throws.
 */

import { useCallback } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

export interface MicPermissionStatus {
  granted: boolean;
  denied: boolean;
  prompt: boolean;
}

export function useCallPermissions() {
  const checkMicrophonePermission = useCallback(async (): Promise<MicPermissionStatus> => {
    if (Platform.OS === 'android') {
      try {
        const has = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (has) {
          return { granted: true, denied: false, prompt: false };
        }
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          return { granted: true, denied: false, prompt: false };
        }
        if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          return { granted: false, denied: true, prompt: false };
        }
        return { granted: false, denied: true, prompt: false };
      } catch {
        return { granted: false, denied: false, prompt: true };
      }
    }

    // iOS: defer to the getUserMedia system prompt.
    return { granted: false, denied: false, prompt: true };
  }, []);

  return { checkMicrophonePermission };
}
