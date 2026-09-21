# Bottom Tab Navigation Migration — Design

**Date:** 2026-07-07
**Status:** Approved by user (sections 1–3 approved in brainstorming session)

## Problem

Bottom tab switching lags. Tabs are implemented on top of plain `Stack`
navigators with a hand-rolled global bar (`BottomTabBar` rendered by
`GlobalTabBar` in `app/_layout.tsx`), and taps go through `router.navigate`.

Verified root cause (React Navigation 7 `StackRouter`, `@react-navigation/routers`
7.5.5, expo-router ~6.0.23):

1. **Every tap on a non-current tab pushes a brand-new screen instance.**
   `NAVIGATE` without `pop: true` only reuses a route when it is already the
   top of the stack. There is no "return to existing tab" behavior. Each tap
   pays a full native-view mount of the destination screen — the visible lag.
2. **Screen instances accumulate.** Tab-hopping grows the stack without bound
   (memory growth), and Android hardware back replays the entire tab-tap
   history instead of the standard back-to-home-then-exit.
3. **`optimisticTab` in `BottomTabBar` masks the symptom** — it flips the
   highlight instantly, but the destination screen still remounts.
4. **`refetchOnMount: 'always'`** (global query default) fires network requests
   on every tab tap because every tap is a fresh mount, adding JS work during
   the already-heavy mount.

No mitigations present: no `freezeOnBlur`, `enableFreeze`,
`detachInactiveScreens`, or `dangerouslySingular` anywhere in the app.

## Decision

Migrate tab roots to a real expo-router `Tabs` navigator (Option A from
brainstorming). Tabs mount lazily on first visit and stay alive afterwards;
switching shows an already-built screen. The custom `BottomTabBar` UI is kept
pixel-identical and becomes the navigator's `tabBar`.

Rejected alternatives:

- **`dangerouslySingular` patch** — small diff, dedupes instances, but back
  behavior stays non-standard and the `optimisticTab` / `TAB_PATHS` band-aids
  remain. Kept as documented fallback only.
- **`router.replace`** — fixes stack growth but still remounts every tap; does
  not fix the lag.

## Route structure

```text
app/
  _layout.tsx           root Stack: (auth) | (tabs) | (public) | (app)
  (tabs)/
    _layout.tsx         NEW: Tabs navigator, custom tabBar = BottomTabBar
    index.tsx           home   (moved from (public)/index.tsx)
    listings.tsx        (moved from (app)/listings/index.tsx)
    leads.tsx           (moved from (app)/leads/index.tsx)
    calls.tsx           (moved from (app)/calls/index.tsx)
    chat.tsx            (moved from (app)/chat/index.tsx)
    favourites.tsx      (moved from (app)/favourites.tsx)
    profile.tsx         (moved from (app)/profile.tsx)
  (app)/                everything else stays: listings/[id], listings/sell,
                        leads/create, calls/[uuid], chat/[id], modals,
                        settings screens…
  (public)/             stays: properties/, new-projects/ detail screens
```

- `(tabs)` is flat — **no nested groups**. Inside a Tabs navigator each direct
  child is one tab; a `(group)` folder would collapse its contents into a
  single tab with a nested stack. (Explicitly discussed and accepted.)
- Tab route files stay thin wrappers (guard + render feature screen); real
  code remains in `src/features/…`.
- URLs unchanged — group folders are not part of the path, so notification
  deep-links (`/leads`, `/listings/:id`, see
  `src/features/notifications/utils/resolve-redirect.ts`) keep working.
  expo-router converts `NAVIGATE` to `JUMP_TO` when the target navigator is a
  tab navigator.
- Detail screens stay **outside** the tabs navigator in the root stack, so
  they push over the tab bar and cover it, matching current UX.

## Tabs navigator — `(tabs)/_layout.tsx`

- `<Tabs tabBar={(props) => <BottomTabBar {...props} />} screenOptions={...}>`
  declaring all 7 screens.
- Lazy mount (default): a tab builds on first visit only.
- `freezeOnBlur: true`: hidden tabs stop re-rendering.
- Back behavior: React Navigation default (`firstRoute`) — back from any tab
  goes to Home, back from Home exits. Standard tab-app behavior.
- Slim gate in the layout (copied from `(app)/_layout.tsx`): onboarding
  redirect + `MOBILE_BLOCKED_ROLES` redirect. **No** `isAuthenticated`
  redirect — home is public.

## BottomTabBar changes (visual: zero change)

File: `src/features/new-projects/components/BottomTabBar.tsx`

1. Delete `optimisticTab` state + effect — active tab derives from
   `state.index` passed by the navigator (synchronous on tap).
2. Delete `pathnameToTab` + `usePathname` usage.
3. Tap handler: `router.navigate(href)` → `navigation.jumpTo(routeName)`.
4. Keep unchanged: role/permission tab filtering (`AUTHED_TABS` /
   `PUBLIC_TABS` / `CUSTOMER_TABS`, `useCan`), guest auth-prompt branch, More
   branch (`useMoreSheetStore.present()` — More is a button, not a route),
   approvals dot, spring press animation, `useBottomTabBarSpace` export and
   its consumers.
5. Bar keeps overlay positioning so existing `useBottomTabBarSpace()` padding
   in screens keeps working unchanged.

## Root `_layout.tsx` cleanup

- Delete `GlobalTabBar` and `TAB_PATHS` (pathname-based show/hide hack).
- Root stack screens: `(auth)`, `(tabs)`, `(public)`, `(app)`.
- Remove `animation: 'none'` from `(public)` / `(app)` — it existed only for
  tab taps; detail pushes get the normal slide back.
- Move `AuthPromptModal` from `(public)/_layout.tsx` to root layout (guest
  tabs now live in `(tabs)`).
- Everything else in root layout (splash, biometric lock, call provider,
  keyboard toolbar pathname check, toasts, portals) untouched.

## `(app)/_layout.tsx` cleanup

- Keep the full auth gate for remaining detail/settings screens.
- Remove `Stack.Screen` entries for moved routes (`listings/index`,
  `leads/index`, `chat/index`, `calls/index`, `favourites`, `profile`) to
  avoid route-name warnings.

## Guards

- listings / leads / calls / chat tab screens: existing `useRequirePermission`
  guards move with the files (denied → redirect home).
- favourites / profile: add a small guard — not signed in → redirect home.
  Belt-and-braces; the bar already hides these tabs from guests.

## Data refresh on tab focus

User-selected behavior: **refetch on tab focus when stale.**

- New shared hook (e.g. `useRefetchOnTabFocus`): on tab focus (skipping first
  mount), if the screen's main query data is older than `staleTime` (30s),
  silently `refetch()` in background — cached data stays visible, fresh data
  swaps in.
- Applied to each tab screen's primary query: leads overview, listings
  landing, chat inbox, calls list, favourites, home dashboard.
- Global query defaults (`staleTime: 30s`, `refetchOnMount: 'always'`)
  untouched — tabs no longer remount, so `refetchOnMount` stops firing on tab
  switches naturally.

## Risks and mitigations

| Risk                                                       | Mitigation                                                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Notification deep-links land on tab routes                 | Paths unchanged; NAVIGATE→JUMP_TO conversion; manually QA every `resolve-redirect.ts` rule |
| Chat inbox stays mounted → listeners live while tab hidden | Intended (faster badge updates); verify no duplicate WebSocket handlers                    |
| Stale `Stack.Screen` entries in `(app)/_layout`            | Removed as part of migration                                                               |
| Memory: up to 7 screens alive                              | Lazy mount + `freezeOnBlur`; QA on low-end Android                                         |
| Overlays (splash, biometric, minimized call bar)           | Live in root layout above the stack — untouched; still on QA list                          |

## Verification

No unit tests in this repo (project convention). Gate on:

- `tsc --noEmit` clean
- `pnpm lint` clean
- Manual QA checklist:
  - Tab switching speed (first visit vs revisit) on iOS + Android
  - Android hardware back: non-home tab → Home → exit; detail screen → pops to tab
  - Guest flow: public tabs, auth prompt on Favourites/Profile, sign-in transition
  - Role-based tab sets: guest / client-customer / staff with partial permissions
  - More sheet opens; approvals pending dot renders
  - Create-lead FAB position above bar
  - Push-notification deep links: lead detail, listing detail, wizard edit, list fallbacks
  - Detail screens slide over and cover the bar
  - Onboarding first-run redirect; biometric lock; minimized-call top bar reserve
  - Data freshness: switch away > 30s → return → background refetch swaps data
