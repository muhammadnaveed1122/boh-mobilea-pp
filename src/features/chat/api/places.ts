import type { MessageLocation } from '../models/message';
import type { Coords } from '../media/location';

/**
 * Google Places (web service) client. Reuses the Maps API key. NOTE: these
 * HTTP endpoints require the key to have the "Places API" enabled and to NOT
 * be locked to Android/iOS app restrictions only (they are server-side calls).
 * All functions fail soft (return [] / null) so the picker degrades to
 * map + pin + reverse-geocode when Places is unavailable.
 */
const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const BASE = 'https://maps.googleapis.com/maps/api/place';

export interface PlacePrediction {
  placeId: string;
  primary: string;
  secondary?: string;
}

export interface NearbyPlace {
  placeId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function placeAutocomplete(input: string, near?: Coords): Promise<PlacePrediction[]> {
  if (!KEY || input.trim().length < 2) return [];
  const loc = near ? `&location=${near.latitude},${near.longitude}&radius=20000` : '';
  const url = `${BASE}/autocomplete/json?input=${encodeURIComponent(input)}${loc}&key=${KEY}`;
  const data = await getJson<{
    predictions?: {
      place_id: string;
      structured_formatting?: { main_text?: string; secondary_text?: string };
      description?: string;
    }[];
  }>(url);
  return (data?.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    primary: p.structured_formatting?.main_text ?? p.description ?? '',
    secondary: p.structured_formatting?.secondary_text,
  }));
}

export async function placeDetails(placeId: string): Promise<MessageLocation | null> {
  if (!KEY) return null;
  const url = `${BASE}/details/json?place_id=${placeId}&fields=geometry,name,formatted_address&key=${KEY}`;
  const data = await getJson<{
    result?: {
      name?: string;
      formatted_address?: string;
      geometry?: { location?: { lat: number; lng: number } };
    };
  }>(url);
  const r = data?.result;
  const loc = r?.geometry?.location;
  if (!r || !loc) return null;
  return { latitude: loc.lat, longitude: loc.lng, name: r.name, address: r.formatted_address };
}

export async function nearbyPlaces(coords: Coords): Promise<NearbyPlace[]> {
  if (!KEY) return [];
  const url = `${BASE}/nearbysearch/json?location=${coords.latitude},${coords.longitude}&radius=1500&key=${KEY}`;
  const data = await getJson<{
    results?: {
      place_id: string;
      name?: string;
      vicinity?: string;
      geometry?: { location?: { lat: number; lng: number } };
    }[];
  }>(url);
  return (data?.results ?? [])
    .filter((r) => r.geometry?.location)
    .map((r) => ({
      placeId: r.place_id,
      name: r.name ?? 'Unknown place',
      address: r.vicinity,
      latitude: r.geometry!.location!.lat,
      longitude: r.geometry!.location!.lng,
    }));
}
