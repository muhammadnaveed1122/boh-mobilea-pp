// One-slot holder for a deep link the app could not honour the moment it arrived.
//
// A universal link tapped on a COLD start navigates immediately, while the session is still being
// read back from SecureStore. At that instant `isAuthenticated` is false even for a signed-in user,
// so `(app)/_layout` redirects to /login and the target is gone. Same story when the user really is
// signed out and has to sign in first. `+native-intent` parks the destination here and
// `(auth)/_layout` uses it as its post-authentication redirect target instead of `/`.
//
// A plain module singleton rather than a store: the only writer (`+native-intent`) runs outside
// React, and the only reader redirects declaratively from render — there is nothing to subscribe to.

let pendingHref: string | null = null;

export function setPendingLink(href: string): void {
  pendingHref = href;
}

/**
 * Read WITHOUT clearing — deliberately safe to call during render, and stable across re-renders so
 * the auth layout's `<Redirect>` cannot change target mid-flight and race itself. Clearing is the
 * job of {@link clearPendingLink}, which the auth layout runs on unmount once the redirect has
 * carried the user away.
 */
export function peekPendingLink(): string | null {
  return pendingHref;
}

export function clearPendingLink(): void {
  pendingHref = null;
}
