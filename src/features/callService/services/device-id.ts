/**
 * Stable per-install device identifier for call-service device-token requests.
 *
 * Generated once on first use (`expo-crypto` UUID v4 — no `getRandomValues`
 * polyfill needed, unlike the `uuid` package under Hermes) and persisted in
 * AsyncStorage, so the same id is sent on every `POST /call-service/device-tokens`
 * across launches. The backend keys a device row on it (token rotates, id does not).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const DEVICE_ID_KEY = 'callService.deviceId.v1';

// In-memory cache so concurrent callers within a session share one read/write.
let cached: Promise<string> | null = null;

async function loadOrCreate(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

/**
 * Returns this install's persistent device id, generating + storing it on first
 * call. Idempotent across launches and concurrent calls within a session.
 */
export function getDeviceId(): Promise<string> {
  cached ??= loadOrCreate();
  return cached;
}
