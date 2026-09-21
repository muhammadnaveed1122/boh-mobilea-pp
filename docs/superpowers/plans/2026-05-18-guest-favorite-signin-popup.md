# Guest Favorite → Sign-In Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an unauthenticated user taps the heart on a home-screen project card, show the existing login form in a popup instead of toggling favorite.

**Architecture:** A tiny zustand store holds popup visibility. One `AuthPromptModal` (RN `Modal` wrapping the existing `AuthSheet` + `AuthForm`) is mounted once in the public layout. The card's heart calls `open()` when the user is unauthenticated; the modal auto-closes when `isAuthenticated` flips true. No form duplication — `AuthForm`/`AuthSheet` reused verbatim.

**Tech Stack:** React Native 0.81, Expo Router, zustand, NativeWind, TypeScript (strict).

**Testing note:** This repo has no test runner (project convention — no unit tests). Each task is verified with `npx tsc --noEmit` + `pnpm lint`, then a final manual QA pass. Commits are per task.

---

### Task 1: Auth-prompt visibility store

**Files:**

- Create: `src/store/auth-prompt.store.ts`

- [ ] **Step 1: Create the store**

Mirror the existing zustand pattern from `src/store/auth.store.ts` (named `useXxxStore`, `create<State>()`).

```ts
import { create } from 'zustand';

interface AuthPromptState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useAuthPromptStore = create<AuthPromptState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/auth-prompt.store.ts
git commit -m "feat: add auth-prompt visibility store"
```

---

### Task 2: AuthPromptModal component

**Files:**

- Create: `src/features/auth/components/AuthPromptModal.tsx`

Depends on Task 1 (`useAuthPromptStore`). Reuses existing `AuthSheet`
(`src/features/auth/components/AuthSheet.tsx`) and `AuthForm`
(`src/features/auth/components/AuthForm.tsx`) unchanged. `useAuthStore` exposes
`isAuthenticated` (`src/store/auth.store.ts`).

- [ ] **Step 1: Create the component**

```tsx
import { useEffect } from 'react';
import { Modal } from 'react-native';
import { AuthSheet } from '@/features/auth/components/AuthSheet';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { useAuthStore } from '@/store/auth.store';
import { useAuthPromptStore } from '@/store/auth-prompt.store';

export function AuthPromptModal() {
  const isOpen = useAuthPromptStore((s) => s.isOpen);
  const close = useAuthPromptStore((s) => s.close);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      close();
    }
  }, [isOpen, isAuthenticated, close]);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <AuthSheet onSkip={close}>
        <AuthForm />
      </AuthSheet>
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/auth/components/AuthPromptModal.tsx
git commit -m "feat: add AuthPromptModal reusing AuthSheet + AuthForm"
```

---

### Task 3: Mount AuthPromptModal in public layout

**Files:**

- Modify: `app/(public)/_layout.tsx`

Current content:

```tsx
import { Stack } from 'expo-router';

export default function PublicLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 1: Mount the modal once alongside the Stack**

Replace the file with:

```tsx
import { Fragment } from 'react';
import { Stack } from 'expo-router';
import { AuthPromptModal } from '@/features/auth/components/AuthPromptModal';

export default function PublicLayout() {
  return (
    <Fragment>
      <Stack screenOptions={{ headerShown: false }} />
      <AuthPromptModal />
    </Fragment>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/_layout.tsx"
git commit -m "feat: mount AuthPromptModal in public layout"
```

---

### Task 4: Gate heart press behind auth

**Files:**

- Modify: `src/features/new-projects/components/listing-card/ProjectCardOverlay.tsx`

Current relevant code (lines 1-30): imports `useState`; heart `Pressable`
`onPress={() => setFavorite((v) => !v)}`.

- [ ] **Step 1: Add store imports**

After the existing import block (the `import { useProjectCard } from './ProjectCardContext';` line), add:

```tsx
import { useAuthStore } from '@/store/auth.store';
import { useAuthPromptStore } from '@/store/auth-prompt.store';
```

- [ ] **Step 2: Read auth state + open action in the component**

Inside `ProjectCardOverlay`, immediately after `const [favorite, setFavorite] = useState(false);`, add:

```tsx
const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
const openAuthPrompt = useAuthPromptStore((s) => s.open);

function handleHeartPress() {
  if (!isAuthenticated) {
    openAuthPrompt();
    return;
  }
  setFavorite((v) => !v);
}
```

- [ ] **Step 3: Wire the heart Pressable to the handler**

On the heart `Pressable`, change the prop `onPress={() => setFavorite((v) => !v)}` to `onPress={handleHeartPress}` (JSX attribute — no spaces, no semicolon).

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/new-projects/components/listing-card/ProjectCardOverlay.tsx
git commit -m "feat: prompt sign-in when guest taps favorite heart"
```

---

### Task 5: Manual QA verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck + lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no errors.

- [ ] **Step 2: Manual QA on simulator** (`pnpm ios` or `pnpm android`)

Confirm each:

- Guest (logged out) on home screen taps heart → sign-in popup slides up (same form/look as `(auth)/login`).
- Tap "Skip" / drag sheet down / Android back → popup closes, no favorite toggled.
- Sign in successfully from popup → popup auto-closes, header switches to authenticated state.
- Authenticated user taps heart → heart toggles red/white, no popup.
- Open popup, switch to Sign Up tab, submit → routes to OTP screen as it does from `(auth)/login` (no regression).

- [ ] **Step 3: No commit** (verification only). If QA finds a defect, fix under the relevant task and re-run Step 1.

---

## Revision 2026-05-18 — Centered Dialog (post-implementation feedback)

Tasks 1–4 shipped (commits `218d161`, `7a68577`, `0874fab`, `ee546a8`). User
rejected the `AuthSheet` bottom-sheet visual; popup must be a centered card
modal, no redirect. Two follow-up tasks:

### Task R1: Add `scrollable` prop to `Dialog` atom

**Files:** Modify `src/components/atoms/Dialog.tsx`

Add `scrollable?: boolean` to `DialogProps` (default `false`). When `false`,
output is unchanged (existing consumers `EnableMfaPrompt`, `FloorPlansSection`,
`BrochureDownloadModal` unaffected). When `true`:

- Cap the card with `maxHeight` ≈ 85% of `Dimensions.get('window').height`.
- Render `children` inside a `ScrollView` (`keyboardShouldPersistTaps="handled"`,
  `showsVerticalScrollIndicator={false}`).
- Wrap the centering container in `KeyboardAvoidingView` from
  `react-native-keyboard-controller` (`behavior="padding"`) so inputs lift above
  the keyboard.

- [ ] Step 1: Implement additive prop (default path byte-identical).
- [ ] Step 2: `npx tsc --noEmit && pnpm lint` — no new errors.
- [ ] Step 3: Commit `feat: add scrollable option to Dialog atom`.

### Task R2: AuthPromptModal uses Dialog instead of AuthSheet

**Files:** Modify `src/features/auth/components/AuthPromptModal.tsx`

Replace the `Modal`+`AuthSheet` wrapper with the `Dialog` atom; drop the
`AuthSheet` and `Modal` imports. Keep store wiring + auto-close `useEffect`.

```tsx
import { useEffect } from 'react';
import { Dialog } from '@/components/atoms/Dialog';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { useAuthStore } from '@/store/auth.store';
import { useAuthPromptStore } from '@/store/auth-prompt.store';

export function AuthPromptModal() {
  const isOpen = useAuthPromptStore((s) => s.isOpen);
  const close = useAuthPromptStore((s) => s.close);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      close();
    }
  }, [isOpen, isAuthenticated, close]);

  return (
    <Dialog visible={isOpen} onRequestClose={close} scrollable>
      <AuthForm />
    </Dialog>
  );
}
```

- [ ] Step 1: Implement.
- [ ] Step 2: `npx tsc --noEmit && pnpm lint` — no new errors.
- [ ] Step 3: Commit `feat: switch sign-in popup to centered Dialog`.

`AuthSheet`, `AuthForm`, `app/(public)/_layout.tsx`, `ProjectCardOverlay.tsx`
unchanged by this revision.

---

## Self-Review

**Spec coverage:**

- Store → Task 1. Modal reusing AuthSheet+AuthForm → Task 2. Mount once → Task 3. Heart gating (guest→open, authed→toggle) → Task 4. Auto-close on auth success → Task 2 `useEffect`. Skip/back close → Task 2 (`onSkip`/`onRequestClose`). MFA/OTP path unchanged → Task 5 QA. Verification (tsc/lint/manual) → every task + Task 5. All spec sections covered.

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands explicit. Clean.

**Type consistency:** `useAuthPromptStore` shape (`isOpen`/`open`/`close`) defined Task 1, consumed identically Tasks 2 & 4. `useAuthStore((s) => s.isAuthenticated)` matches existing store usage in `HomeScreen.tsx`/`AuthForm.tsx`. `AuthSheet` prop `onSkip` and `AuthForm` no-props match their definitions. Consistent.
