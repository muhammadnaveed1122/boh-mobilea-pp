import type { MessageLocation } from '../models/message';

/**
 * expo-location is a native module that requires a dev build. Load it lazily
 * and defensively so a missing native module never crashes the chat screen at
 * import time — location sharing is simply unavailable until the app is rebuilt
 * (expo run:ios / run:android / EAS dev build). Mirrors media/pick-media.ts.
 */
type LocationModule = typeof import('expo-location');
let cached: LocationModule | null | undefined;

function getLocation(): LocationModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-location') as LocationModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** Whether native location is available in this build. */
export function isLocationPickingAvailable(): boolean {
  return getLocation() !== null;
}

export interface Coords {
  latitude: number;
  longitude: number;
}

/** Request permission and read current GPS. Returns null on denial/unavailable. */
export async function requestAndGetCurrentCoords(): Promise<Coords | null> {
  const mod = getLocation();
  if (!mod) return null;
  try {
    const perm = await mod.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await mod.getCurrentPositionAsync({ accuracy: mod.Accuracy.Balanced });
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

/** Reverse-geocode coords to a place name + street address. Best-effort. */
export async function reverseGeocode(coords: Coords): Promise<{ name?: string; address?: string }> {
  const mod = getLocation();
  if (!mod) return {};
  try {
    const [first] = await mod.reverseGeocodeAsync(coords);
    if (!first) return {};
    const street = [first.name, first.street].filter(Boolean).join(' ');
    const address = [street || undefined, first.city, first.region, first.country]
      .filter(Boolean)
      .join(', ');
    return { name: first.name ?? undefined, address: address || undefined };
  } catch {
    return {};
  }
}

/** Narrow a partial location result to a full MessageLocation. */
export function toMessageLocation(
  coords: Coords,
  meta: { name?: string; address?: string },
): MessageLocation {
  return { latitude: coords.latitude, longitude: coords.longitude, ...meta };
}
