import * as ImagePicker from 'expo-image-picker';

import type { WizardDocItem, WizardMediaItem } from './types';

/** expo-document-picker is loaded lazily/defensively — a missing native module (pre-rebuild)
 *  never crashes the screen; document picking is simply unavailable until the app is rebuilt. */
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

export function isDocumentPickingAvailable(): boolean {
  return getDocumentPicker() !== null;
}

function nameFromUri(uri: string, fallback: string): string {
  const last = uri.split('/').pop();
  return last && last.trim() !== '' ? last : fallback;
}

/** Pick multiple images/videos from the library. Returns [] on cancel/denial. */
export async function pickMediaMulti(): Promise<WizardMediaItem[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    quality: 0.8,
  });
  if (res.canceled || !res.assets || res.assets.length === 0) return [];
  return res.assets.map((a) => {
    const type: WizardMediaItem['type'] = a.type === 'video' ? 'video' : 'image';
    const mimeType = a.mimeType ?? (type === 'video' ? 'video/mp4' : 'image/jpeg');
    return {
      uri: a.uri,
      name: a.fileName ?? nameFromUri(a.uri, type === 'video' ? 'video.mp4' : 'photo.jpg'),
      mimeType,
      type,
      altText: '',
      isHero: false,
      order: 0,
    };
  });
}

/** Pick a single image from the library. Returns null on cancel/denial. */
export async function pickSingleImage(): Promise<WizardMediaItem | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  if (res.canceled || !res.assets || res.assets.length === 0) return null;
  const a = res.assets[0]!;
  const mimeType = a.mimeType ?? 'image/jpeg';
  return {
    uri: a.uri,
    name: a.fileName ?? nameFromUri(a.uri, 'photo.jpg'),
    mimeType,
    type: 'image',
    altText: '',
    isHero: false,
    order: 0,
  };
}

/** Pick multiple documents. Returns [] on cancel or when the native module is unavailable. */
export async function pickDocumentsMulti(): Promise<WizardDocItem[]> {
  const mod = getDocumentPicker();
  if (!mod) return [];
  const res = await mod.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: [
      'image/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  });
  if (res.canceled || !res.assets || res.assets.length === 0) return [];
  return res.assets.map((a) => ({
    uri: a.uri,
    name: a.name ?? nameFromUri(a.uri, 'document'),
    mimeType: a.mimeType ?? 'application/octet-stream',
  }));
}

/** Pick a single document. Returns null on cancel or when the native module is unavailable. */
export async function pickSingleDocument(): Promise<WizardDocItem | null> {
  const mod = getDocumentPicker();
  if (!mod) return null;
  const res = await mod.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
    type: [
      'image/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  });
  if (res.canceled || !res.assets || res.assets.length === 0) return null;
  const a = res.assets[0]!;
  return {
    uri: a.uri,
    name: a.name ?? nameFromUri(a.uri, 'document'),
    mimeType: a.mimeType ?? 'application/octet-stream',
  };
}
