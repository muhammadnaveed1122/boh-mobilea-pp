// Expo Router's hook for rewriting an incoming deep link BEFORE it is matched against the route
// tree. Every OS-delivered URL passes through here — verified https links from
// rhkproperties.com (Universal Links / App Links) as well as `bohmobile://` scheme links.

import { resolveIncomingUrl } from '@/lib/deep-links';
import { setPendingLink } from '@/lib/pending-link';
import { useAuthStore } from '@/store/auth.store';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  const href = resolveIncomingUrl(path);
  // Not a web URL we translate (scheme links already carry in-app paths) — hand it back untouched.
  if (!href) return path;

  // On a cold start the session is still being read from SecureStore, so `isAuthenticated` is false
  // here even for a signed-in user and `(app)/_layout` will bounce this navigation straight to
  // /login. Park the destination so `(auth)/_layout` redirects there instead of `/` once auth
  // settles; the same path covers a genuinely signed-out user who has to log in first.
  if (!useAuthStore.getState().isAuthenticated) setPendingLink(href);

  return href;
}
