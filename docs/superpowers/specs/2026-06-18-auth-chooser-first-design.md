# Chooser-first auth flow — design

**Date:** 2026-06-18
**Repo:** boh-mobile
**Status:** Approved design, pending implementation plan

## Goal

Replace the current direct-fields auth entry with an option **chooser**. The user
first picks a method (Apple / Google / email); email/password fields stay hidden
until they choose "Sign in with email". Applies to **both** auth entry points.

## Current state

`AuthForm` renders in two places:

1. **Full-screen** — `app/(auth)/login.tsx` wraps `<AuthSheet><AuthForm/></AuthSheet>`
   (swipeable drawer with Skip). Shown on cold start / session expiry.
2. **In-app modal** — `src/features/auth/components/AuthPromptModal.tsx` wraps
   `<Dialog><AuthForm/></Dialog>`. Triggered by `auth-prompt.store.ts` when a guest
   taps the Favorite heart or a gated tab (Favourites / Profile).

Today `AuthForm` shows Sign In / Sign Up tabs with email + password fields directly
visible (lines ~244–280), plus an "Or" divider and Google + Apple buttons below
(lines ~285–314). Both entry points therefore show fields immediately.

## Decisions

| #              | Decision                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Email behavior | **Keep tabs** — "Sign in with email" lands on the existing tabbed Sign In / Sign Up form (no email-first identifier lookup). |
| Nav model      | **State toggle** inside a shared flow component: `view: 'chooser' \| 'form'`. No new route.                                  |
| Social buttons | Live **only on the chooser**. Removed from `AuthForm`.                                                                       |
| Back from form | **Back arrow** top-left swaps `view` → `'chooser'`. Android hardware back also returns to chooser when in form view.         |
| Default tab    | Email tap opens **Sign In** tab (still switchable to Sign Up).                                                               |
| Skip           | **Chooser only**, on the full-screen flow (existing `AuthSheet` Skip). Modal uses its own Dialog close.                      |
| Scope          | **Both** entry points get chooser-first via one shared component (Option A). No inconsistency, no duplicated social code.    |
| Backend        | **No change.** Pure UI restructure. Social handlers keep calling `/auth/google/mobile` and `/auth/apple/mobile`.             |

## Architecture

Three components, clear boundaries:

### `AuthChooser` (new)

- **Does:** renders the method picker — `Sign in with Apple` (iOS, gated by existing
  `isAppleSignInAvailable()`), `Continue with Google`, `Sign in with email`.
- **Owns:** the social sign-in logic moved out of `AuthForm` (Apple/Google token
  retrieval → `/auth/*/mobile` calls → `setAuth`).
- **Props:** `onEmailPress()`, `onAuthSuccess()` (for social completion).
- **Deps:** `AppleSignInButton`, `GoogleSignInButton`, `apple-signin.ts`,
  `google-signin.ts`, auth store.

### `AuthForm` (refactored)

- **Does:** email/password only — the existing Sign In / Sign Up tabs.
- **Removed:** "Or" divider + Google/Apple section (lines ~285–314).
- **Added:** `onBack()` prop → renders a back arrow top-left that returns to chooser.
- **Default:** Sign In tab.

### `AuthFlow` (new, shared)

- **Does:** holds `view` state, renders `AuthChooser` (default) or `AuthForm`.
- **Wires:** chooser `onEmailPress` → `view='form'`; form `onBack` → `view='chooser'`.
- **Android back:** `BackHandler` effect — when `view==='form'`, intercept hardware
  back → set `view='chooser'` (return true). When `view==='chooser'`, default behavior.
- **Props:** `onAuthSuccess()` passed through to both children.

### Consumers

- `login.tsx`: `<AuthSheet onSkip={handleSkip}><AuthFlow onAuthSuccess={...}/></AuthSheet>`.
  Skip remains on `AuthSheet`.
- `AuthPromptModal.tsx`: `<Dialog><AuthFlow onAuthSuccess={close} .../></Dialog>`.

## Data flow

```
Chooser view
  ├─ Apple  → apple-signin token → POST /auth/apple/mobile  → setAuth → onAuthSuccess
  ├─ Google → google-signin token → POST /auth/google/mobile → setAuth → onAuthSuccess
  └─ Email  → view='form'
Form view (Sign In default | Sign Up)
  ├─ back arrow / Android back → view='chooser'
  └─ submit → existing signin/signup services (unchanged: OTP, MFA, set-password routes)
```

## Out of scope / unchanged

- OTP, MFA, forgot/set-password sub-screens (`verify-signup-otp`, `mfa-verify`,
  `forgot-password`, `set-password`) — separate routes, untouched.
- Skip behavior (`skipAuth()`), biometric unlock, token refresh, secure storage.
- Backend endpoints and request/response shapes.

## Edge cases

- **Apple unavailable** (non-iOS / iOS <13): hide Apple button via existing
  `isAppleSignInAvailable()` check.
- **Modal close mid-form:** Dialog close from chooser closes the modal; from form,
  Android back goes chooser→ first (does not close on first press while in form).
- **Session-expiry re-entry:** login.tsx always opens on chooser view (default state).

## Testing

Per repo convention (no unit tests in boh-mobile): verify via `tsc` + lint + manual QA.
Manual QA checklist:

- Cold start → chooser shows, no fields visible.
- Apple (iOS) / Google complete sign-in from chooser.
- Email → form, Sign In tab default, back arrow → chooser, Android back → chooser.
- Guest taps Favorite → modal opens on chooser → same flow.
- Skip from chooser (full-screen) works.
