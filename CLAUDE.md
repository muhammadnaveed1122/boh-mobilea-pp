# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Expo Router app (React Native 0.81, React 19, Expo SDK 54, New Architecture enabled). Sibling project under `boh/` — see `../CLAUDE.md` for the wider `boh` initiative; this repo is the mobile client only.

Package manager: **pnpm** (lockfile is `pnpm-lock.yaml`; `package-lock.json` is stale legacy — do not regenerate it). `pnpm-workspace.yaml` only exists to permit the `unrs-resolver` postinstall build.

## Commands

```bash
pnpm start              # Expo dev server (metro)
pnpm ios                # iOS simulator
pnpm android            # Android emulator
pnpm web                # Web target (metro bundler)
pnpm lint               # eslint .
pnpm lint:fix
pnpm format             # prettier --write
pnpm format:check
```

No test runner is configured. Husky `pre-commit` runs `lint-staged` (eslint --fix + prettier on staged TS/JS/JSON/MD/CSS).

## Path aliases

Two aliases defined in **both** `tsconfig.json` and `babel.config.js` (module-resolver) — keep them in sync if either changes:

- `@/*` → `src/*`
- `@theme` → `theme/index.ts`, `@theme/*` → `theme/*`

## Architecture

### Routing — Expo Router (file-based, typed routes on)

```text
app/
  _layout.tsx              Root: SafeArea → QueryClient → Theme → KeyboardProvider → Stack
  (auth)/login.tsx         Unauthenticated stack
  (app)/
    _layout.tsx            Auth gate — redirects to /(auth)/login when !isAuthenticated
    (tabs)/                Bottom tabs: index | (properties) | (leads) | (profile)
    modals/                add-property, add-lead (Stack `presentation: 'modal'`)
```

Auth gating is enforced by the `(app)/_layout.tsx` `<Redirect>` driven by `useAuthStore`. Splash screen is custom: `expo-splash-screen.preventAutoHideAsync()` runs at module load, then the Lottie `<AnimatedSplash>` overlay calls `onFinish` to unmount itself.

### Styling — NativeWind v4 + Tailwind v3

- `global.css` imported once in `app/_layout.tsx` is the Tailwind entrypoint.
- `metro.config.js` wraps the Expo Metro config with `withNativeWind({ input: './global.css', inlineRem: 16 })`.
- `babel.config.js` uses `babel-preset-expo` with `jsxImportSource: 'nativewind'` + `nativewind/babel`.
- Tailwind colors are bound to CSS variables (`rgb(var(--primary) / <alpha-value>)`). Don't hard-code hex — use semantic tokens (`bg-background`, `text-foreground`, `border-border`, `text-destructive`, etc.).

### Theming — `theme/`

Single source of truth for color tokens.

- `theme/tokens.ts` — `light`/`dark` RGB-triplet maps for every CSS var the Tailwind config references.
- `theme/ThemeProvider.tsx` — wraps children in a `<View>` whose `style` injects the active palette via `nativewind`'s `vars()`. Persists user preference (`light` | `dark` | `system`) in AsyncStorage via `src/lib/theme-storage.ts`. Exposes `useTheme()` and `useThemeColor(token)` (returns `rgb(...)` string — use this when a _value_ is needed, e.g. tab bar tints, icon colors).
- Import from the `@theme` alias, not relative paths.

The provider renders an empty palette `<View>` until AsyncStorage hydrates — this is intentional, do not skip the hydration gate.

### State

- **Server state**: TanStack Query (`QueryClient` lives in `app/_layout.tsx`; defaults: `retry: 2`, `staleTime: 5min`).
- **Client/auth state**: Zustand store at `src/store/auth.store.ts`. `setAuth` / `clearAuth` _also_ call `setAuthToken()` from `src/lib/api.ts` to keep the axios interceptor in sync — always go through the store, never mutate the axios token directly.
- **Forms**: TanStack React Form with Zod validators, wired through a shared `useAppForm` hook in `src/components/molecules/forms/`. See pattern below.

### HTTP — `src/lib/api.ts`

Single `apiClient = axios.create(...)`. Request interceptor injects `Authorization: Bearer <token>` from an in-memory `_authToken`. Response interceptor clears the token on `401`. `CONFIG.API_BASE_URL` reads `EXPO_PUBLIC_API_BASE_URL` (defaults to `http://localhost:3000`).

### Components — atomic structure under `src/components/`

```text
atoms/        Button, Input, Textarea, Text, Label, Icon, Badge, Checkbox, RadioGroup, ThemeToggle
molecules/    Card (+ Header/Title/Description/Content/Footer), FormField, forms/*
organisms/    Header
```

- `Text` carries a `cva` variants table (`body | small | large | muted | label | title | heading | subheading | lead | error`) and a `TextClassContext` so `Button` can push class strings down to its children's `<Text>`. When making variant-driven atoms, follow this `cva` + context pattern.
- `Icon` is a thin `lucide-react-native/icons` wrapper — pass `name` as a Lucide icon key; color defaults to the `--foreground` theme token.
- Always merge classes with `cn(...)` from `src/lib/utils.ts` (clsx + tailwind-merge).

#### React Native Reusables (RNR)

Atoms are built on **react-native-reusables** conventions — shadcn-style, Tailwind/NativeWind-classed, copy-into-repo (no `react-native-reusables` runtime dep). Unstyled behavior comes from the `@rn-primitives/*` packages that RNR is built on:

- `@rn-primitives/checkbox` → `atoms/Checkbox.tsx`
- `@rn-primitives/radio-group` → `atoms/RadioGroup.tsx`
- `@rn-primitives/label` → `atoms/Label.tsx`
- `@rn-primitives/slot` → `asChild` prop support (e.g. `Text.asChild`)
- `@rn-primitives/portal` → `<PortalHost />` mounted in root `_layout.tsx`, required for popover/menu/dialog primitives

When adding a new primitive (e.g. dialog, dropdown, switch), follow the RNR pattern: install the matching `@rn-primitives/<name>` package, copy the RNR component source into `src/components/atoms/`, restyle with semantic Tailwind tokens (`bg-background`, `text-foreground`, etc.), and use `cva` variants + `TextClassContext` for variant-driven text styling. Do not add `react-native-reusables` as a runtime dep — the components live in this repo.

### Forms pattern

The shared form hook is built once in `src/components/molecules/forms/hook.ts` via TanStack's `createFormHook`, registering `FormInput`, `FormTextarea`, `FormCheckbox`, `FormRadioGroup` as `fieldComponents`. To add a feature form:

1. `src/features/<feature>/forms/<name>.schema.ts` — Zod schema + inferred type.
2. `src/features/<feature>/forms/<name>.form.ts` — wraps `useAppForm({ defaultValues, validators: { onChange: schema }, onSubmit })`.
3. Consume in a screen with `<form.AppField name="...">{(field) => <field.Input label="..." />}</form.AppField>`.

`FormBase` (in `forms/formbase.tsx`) handles label + error-message layout; pass `controlFirst` for inline-checkbox style.

## Conventions

- Strict TypeScript (`strict: true`). Prefer `Readonly<{...}>` on component prop types — the codebase does this consistently, and `eslint-plugin-sonarjs` is configured against it (`prefer-read-only-props` is _off_ to avoid noise, but the convention stands).
- Prettier: single quotes, semis, trailing commas, 100-col width, 2-space indent. `prettier-plugin-tailwindcss` auto-sorts class names — don't fight it.
- ESLint stack: `eslint-config-expo/flat` + `sonarjs.configs.recommended` + `eslint-config-prettier` (last). Sonar cognitive complexity capped at 20; duplicate-string threshold at 5.
- Generated `ios/` and `android/` directories are gitignored — this is a managed Expo project. Don't commit native folders.
