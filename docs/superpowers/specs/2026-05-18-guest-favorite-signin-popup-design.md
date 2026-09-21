# Guest Favorite → Sign-In Popup — Design

Date: 2026-05-18
Status: Approved

## Problem

Home screen (`app/(public)/index.tsx` → `HomeScreen`) shows project cards. Each
card has a heart (favorite) button in `ProjectCardOverlay`. Currently the heart
toggles a local `favorite` state with no auth check. A guest (unauthenticated
user) tapping the heart must instead be prompted to sign in. The popup form must
be the **same** form used on the login screen — single source of truth, no
duplication.

## Existing state (relevant)

- `app/(auth)/login.tsx` renders `<AuthSheet onSkip={...}><AuthForm /></AuthSheet>`.
- `AuthForm` (`src/features/auth/components/AuthForm.tsx`) is already an
  extracted, reusable signin/signup component (tabs, Google, UAE Pass, MFA/OTP
  routing). It calls `setAuth(...)` then `router.replace('/')` on success.
- `AuthSheet` (`src/features/auth/components/AuthSheet.tsx`) is a reusable
  bottom-sheet container (image bg, drag handle, drag-to-dismiss, "Skip").
- Heart lives in `ProjectCardOverlay.tsx`, rendered per card via
  `useProjectCard()` context — many instances on screen.
- Auth state: `useAuthStore` (`src/store/auth.store.ts`) exposes
  `isAuthenticated`.
- Heart appears only in home listing cards. Detail screen has no heart.

**No form extraction needed** — `AuthForm` + `AuthSheet` are already the single
source of truth. The popup reuses both verbatim.

## Architecture

### 1. `src/store/auth-prompt.store.ts` (new)

Tiny zustand store controlling popup visibility:

```ts
interface AuthPromptState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}
```

Rationale: the heart is rendered in N card instances. A per-card modal would
mount N modals. A single global flag + one mounted modal avoids that.

### 2. `src/features/auth/components/AuthPromptModal.tsx` (new)

> **Revision 2026-05-18:** The bottom-sheet (`AuthSheet`, full-screen image
> background + drag handle + Skip) was rejected. The popup is now a **centered
> card dialog** using the existing `Dialog` atom. `AuthSheet` is no longer used
> by the popup (still used by the `(auth)/login` route, unchanged). `AuthForm`
> remains the single source of truth.

```tsx
<Dialog visible={isOpen} onRequestClose={close} scrollable>
  <AuthForm />
</Dialog>
```

- Reads `isOpen` / `close` from `useAuthPromptStore`.
- Subscribes to `useAuthStore(s => s.isAuthenticated)`. When it flips `true`
  while `isOpen` → call `close()` (auth success dismisses the popup). Implemented
  with a `useEffect` on `[isAuthenticated, isOpen]`.
- `AuthForm` and the `Dialog` atom are imported and used unchanged — zero form
  duplication. No navigation/redirect to a sign-in screen: the popup is an
  in-place `Modal` overlay on the home screen.

### 2a. `src/components/atoms/Dialog.tsx` (edit — additive)

The shared `Dialog` atom is centered but has no scroll/keyboard handling, so a
tall form (`AuthForm`: tabs + fields + UAE Pass + Google) would clip and inputs
could sit under the keyboard. Add an **optional, default-off** `scrollable`
prop:

- `scrollable?: boolean` (default `false`).
- When `false`: behavior is byte-identical to today — the 3 existing consumers
  (`EnableMfaPrompt`, `FloorPlansSection`, `BrochureDownloadModal`) are
  unaffected.
- When `true`: the centered card is height-bounded (`maxHeight` ≈ 85% of screen)
  and its children render inside a `KeyboardAwareScrollView` (from
  `react-native-keyboard-controller`, already a dependency) — one component that
  both scrolls tall content and lifts the focused input above the keyboard,
  which is more reliable than a `KeyboardAvoidingView` inside a centered
  transparent `Modal`.

This keeps a single `Dialog` container (no container duplication) and improves
code being touched without restructuring the existing default path.

### 3. `app/(public)/_layout.tsx` (edit)

Mount `<AuthPromptModal />` once inside the public layout (sibling to `<Stack>`),
so a single instance serves every card on the home screen.

### 4. `src/features/new-projects/components/listing-card/ProjectCardOverlay.tsx` (edit)

Heart `onPress`:

- Read `isAuthenticated` from `useAuthStore` and `open` from
  `useAuthPromptStore`.
- If `!isAuthenticated` → `open()` (do **not** toggle local favorite).
- If authenticated → existing local `setFavorite((v) => !v)` behavior unchanged.

### 5. `src/features/new-projects/components/BottomTabBar.tsx` (edit — revision 2026-05-18)

`BottomTabBar` is mounted globally (`app/_layout.tsx` → `GlobalTabBar`). For a
guest it renders `PUBLIC_TABS` (`favourites`, `home`, `profile`). Tapping
`favourites` or `profile` currently `router.navigate`s into the `(app)` group,
whose `(app)/_layout.tsx` `<Redirect>` bounces the guest to `/(auth)/login`.
Requirement: open the same `AuthPromptModal` instead of redirecting.

- Add `requiresAuth?: boolean` to the `TabItem` interface.
- Mark `favourites` and `profile` in `PUBLIC_TABS` with `requiresAuth: true`
  (the only non-`home` public tabs; `home` → `/` is public). `AUTHED_TABS`
  unchanged (only rendered when already authenticated).
- In the tab `onPress`: if `!isAuthenticated && tab.requiresAuth` → run the
  existing press-scale animation, then `useAuthPromptStore.open()` and return
  (skip `router.navigate`). Otherwise the existing navigation path is unchanged.
- The guest only ever sits on a `(public)` route when this fires, so the
  `(public)/_layout.tsx`-mounted `AuthPromptModal` serves it; no new mount, and
  the uncommitted root `app/_layout.tsx` is left untouched.

## Data flow

```
guest taps heart
  → useAuthPromptStore.open()
  → store.isOpen = true
  → AuthPromptModal: Dialog fades in (centered card + AuthForm)
  → user signs in via AuthForm
  → setAuth() → useAuthStore.isAuthenticated = true
  → AuthPromptModal effect detects flip
  → close() → Dialog dismissed
```

`AuthForm`'s existing `router.replace('/')` on success is harmless on the public
route (same screen); the visible effect is the modal closing. There is no
navigation to a sign-in screen at any point — the form is shown in-place.

## Edge cases

- **Backdrop tap / Android hardware back** → route to `close()` (`Dialog`
  `dismissOnBackdropPress` default true + `Modal onRequestClose={close}`). No
  Skip / drag handle (those were AuthSheet-specific and are gone).
- **MFA / signup-OTP paths**: `AuthForm` does `router.push('/(auth)/mfa-verify')`
  or `/(auth)/verify-signup-otp`. This is identical to the login screen's
  behavior today. The modal stays mounted underneath; on return, if the user is
  authenticated the modal auto-closes via the `isAuthenticated` effect. No
  special handling added.
- **Already authenticated**: heart never opens the popup; existing local toggle
  runs.

## Out of scope

- Favorite backend persistence (currently local `useState` only — unchanged).
- Heart on the detail screen (none exists).
- Any change to `AuthForm` or `AuthSheet` internals.
- The default (non-`scrollable`) `Dialog` behavior and its existing 3 consumers.

## Files

| Action | Path                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| add    | `src/store/auth-prompt.store.ts`                                                       |
| add    | `src/features/auth/components/AuthPromptModal.tsx`                                     |
| edit   | `src/components/atoms/Dialog.tsx` (additive `scrollable` prop)                         |
| edit   | `app/(public)/_layout.tsx`                                                             |
| edit   | `src/features/new-projects/components/listing-card/ProjectCardOverlay.tsx`             |
| edit   | `src/features/new-projects/components/BottomTabBar.tsx` (guest protected tab → prompt) |

## Verification

No test runner in this repo (per project memory). Verify via:

- `pnpm lint`
- `npx tsc --noEmit` (typecheck)
- Manual QA: guest taps heart → popup; sign in → popup closes, authenticated;
  authenticated user taps heart → favorite toggles, no popup; Skip/back closes.
