// Universal Link (iOS) / App Link (Android) → in-app route.
//
// When the OS hands a verified link to the app it passes the FULL https URL, e.g.
// `https://rhkproperties.com/my-account/manage-leads/<uuid>`. Expo Router would try to match that
// web path against the file tree and find nothing — the website says `/my-account/manage-leads/:id`
// while the app says `/leads/:id`. `app/+native-intent.ts` runs every incoming URL through here
// first to bridge the two.
//
// The path table itself is NOT duplicated here: it lives in the notifications resolver, which
// already translates these exact backend web routes for push taps. Reusing it is what keeps a
// tapped link and a tapped notification landing on the same screen as routes evolve.

import * as Linking from 'expo-linking';
import { resolveRedirectFromData } from '@/features/notifications/utils/resolve-redirect';

/**
 * Hosts claimed in app.json (`ios.associatedDomains` / `android.intentFilters`) and named in the
 * association files served by boh-lead-magnet. Anything else is left alone — the OS should never
 * hand us a foreign host, but a scheme link (`bohmobile://…`) comes through the same entry point.
 */
const CLAIMED_HOSTS = new Set(['rhkproperties.com', 'www.rhkproperties.com']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Segments under `/leads/` that are real files in `app/(app)/leads/` (plus the `/leads` tab itself).
 * Needed because the web `/manage-leads/:id` rule matches ANY segment — including the site's list
 * tabs (`/manage-leads/pool`) and whatever it gains later — and those would resolve to app routes
 * that do not exist.
 */
const LEAD_ROUTE_SEGMENTS = new Set(['buy', 'rent', 'sell', 'portal', 'all', 'create']);

/**
 * Keep a `/leads/<segment>` target only when the app can actually render it: a real lead id, or a
 * known screen. Everything else drops to the leads tab, which beats stranding the user on a blank
 * "unmatched route" screen.
 */
function toRenderableHref(href: string): string {
  const match = /^\/leads\/([^/?#]+)$/.exec(href);
  if (!match) return href;
  const segment = match[1];
  return UUID.test(segment) || LEAD_ROUTE_SEGMENTS.has(segment) ? href : '/leads';
}

/**
 * Returns the in-app href for an incoming URL, or null when it is not one of ours to rewrite (a
 * foreign host, a custom-scheme link, or a path with no in-app equivalent) — the caller then hands
 * the original path back to Expo Router untouched.
 */
export function resolveIncomingUrl(url: string): string | null {
  let hostname: string | null;
  let path: string | null;
  try {
    ({ hostname, path } = Linking.parse(url));
  } catch {
    return null;
  }

  if (!hostname || !CLAIMED_HOSTS.has(hostname.toLowerCase())) return null;

  // `Linking.parse` strips the leading slash; the redirect rules match on web-style paths.
  const webPath = `/${(path ?? '').replace(/^\/+/, '')}`;
  const href = resolveRedirectFromData(webPath);
  return href ? toRenderableHref(href) : null;
}
