import * as ImagePicker from 'expo-image-picker';

import type { MediaKind, PickedAsset } from '../models/message';

/**
 * expo-document-picker is a native module added after the current dev build.
 * Load it lazily and defensively so a missing native module never crashes the
 * chat screen at import time — document picking is simply unavailable until the
 * app is rebuilt natively (expo run:ios / run:android / EAS dev build).
 */
type DocumentPickerModule = typeof import('expo-document-picker');
let cachedDocPicker: DocumentPickerModule | null | undefined;

function getDocumentPicker(): DocumentPickerModule | null {
  if (cachedDocPicker !== undefined) return cachedDocPicker;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedDocPicker = require('expo-document-picker') as DocumentPickerModule;
  } catch {
    cachedDocPicker = null;
  }
  return cachedDocPicker;
}

/** Whether native document picking is available in this build. */
export function isDocumentPickingAvailable(): boolean {
  return getDocumentPicker() !== null;
}

function nameFromUri(uri: string, fallback: string): string {
  const last = uri.split('/').pop();
  return last && last.trim() !== '' ? last : fallback;
}

/** Pick a photo or video from the library. Returns null on cancel/denial. */
export async function pickPhotoOrVideo(
  mediaTypes: ImagePicker.MediaType[] = ['images', 'videos'],
): Promise<PickedAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    quality: 0.8,
  });
  if (res.canceled || res.assets.length === 0) return null;

  const a = res.assets[0];
  const kind: MediaKind = a.type === 'video' ? 'video' : 'image';
  const mimeType = a.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const name = a.fileName ?? nameFromUri(a.uri, kind === 'video' ? 'video.mp4' : 'photo.jpg');
  return { uri: a.uri, name, mimeType, kind };
}

/** Capture a photo or video with the camera. Returns null on cancel/denial. */
export async function capturePhotoOrVideo(): Promise<PickedAsset | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.8,
  });
  if (res.canceled || res.assets.length === 0) return null;

  const a = res.assets[0];
  const kind: MediaKind = a.type === 'video' ? 'video' : 'image';
  const mimeType = a.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const name = a.fileName ?? nameFromUri(a.uri, kind === 'video' ? 'video.mp4' : 'photo.jpg');
  return { uri: a.uri, name, mimeType, kind };
}

/**
 * Pick an arbitrary document. Returns null on cancel OR when the native
 * document-picker module is unavailable (call isDocumentPickingAvailable()
 * first to message the user).
 */
export async function pickDocument(): Promise<PickedAsset | null> {
  const mod = getDocumentPicker();
  if (!mod) return null;

  const res = await mod.getDocumentAsync({ copyToCacheDirectory: true });
  if (res.canceled || res.assets.length === 0) return null;

  const a = res.assets[0];
  return {
    uri: a.uri,
    name: a.name ?? nameFromUri(a.uri, 'document'),
    mimeType: a.mimeType ?? 'application/octet-stream',
    kind: 'document',
  };
}
