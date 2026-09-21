import { AudioModule, setAudioModeAsync } from 'expo-audio';

import type { PickedAsset } from '../models/message';

/**
 * Request microphone permission and configure the audio session for
 * recording. Returns true when recording can proceed.
 */
export async function ensureRecordingPermission(): Promise<boolean> {
  const status = await AudioModule.requestRecordingPermissionsAsync();
  if (!status.granted) return false;
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  return true;
}

/** Release the recording lock on the audio session after a recording ends. */
export async function releaseRecordingMode(): Promise<void> {
  await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
}

/**
 * Build the PickedAsset for a finished voice note. `expo-audio`'s
 * HIGH_QUALITY preset writes a `.m4a` (AAC in an MP4 container) on both iOS
 * and Android — `audio/mp4` is natively accepted by both the WhatsApp and
 * Messenger Meta APIs, so no transcoding is needed.
 */
export function voiceAssetFromUri(uri: string, durationMs: number): PickedAsset {
  return {
    uri,
    name: `voice-note-${durationMs}.m4a`,
    mimeType: 'audio/mp4',
    kind: 'audio',
    durationMs,
  };
}
