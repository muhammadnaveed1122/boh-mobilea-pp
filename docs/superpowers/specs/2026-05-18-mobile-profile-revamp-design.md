# Mobile Profile Page Revamp — Design

**Date:** 2026-05-18
**Status:** Approved
**Scope:** Main profile page only (`ProfileScreen`) + `MainHeader` tap target. Sub-pages untouched.

## Problem

`ProfileScreen` ([src/features/profile/components/ProfileScreen.tsx](../../../src/features/profile/components/ProfileScreen.tsx)) hard-codes a purple brand (`#4C35E8` / `#6B5BF5`) that does not exist in the theme — the theme `--brand` token is near-black (`16 24 39`) in light, off-white in dark. It also shows fabricated data with no backend source: a stats grid (8 Listings / 48 Deals / 5.0 Rating / 8 Areas), a fixed role string "Senior Property Consultant", and fake "Verified Agent" / "Dubai, UAE" badges. The page must show only real `User` data and respect the theme. The global top header (`MainHeader`) shows the user's avatar + name but is not tappable.

## Goals

- Profile page fully theme-driven (NativeWind semantic tokens, zero hex).
- Display only real `User` data: avatar, name, email, role.
- Layout direction **C — Centered Avatar** (chosen via visual companion).
- Identity area (avatar + name + explicit "Edit Profile" button) → Edit Profile screen.
- `MainHeader` avatar + name → profile page.
- Preserve all existing flows: profile update, change password, MFA, notification settings, theme, sign out.

## Non-Goals

- No changes to sub-pages (personal-information, notification-settings, security, change-password, MFA screens).
- Business Hub card: **removed**.
- Stats grid: **removed**.
- Fake verified/location badges: **removed** (no real badges added).
- No new backend endpoints. No test runner work (boh-mobile has none).

## Real Data Mapping

Source: `useAuthStore((s) => s.user)`, type `User` ([src/types/auth.types.ts](../../../src/types/auth.types.ts)).

| UI element   | Source                                         | Fallback                            |
| ------------ | ---------------------------------------------- | ----------------------------------- |
| Name         | `getDisplayName(user)` (existing helper, keep) | email → "Agent Name"                |
| Avatar image | `user.profile?.profilePicUrl`                  | initials via existing `Avatar` atom |
| Email        | `user.email`                                   | hidden if null                      |
| Role pill    | `user.roles?.[0]?.name`                        | **no pill rendered** if no roles    |

## Layout (Direction C)

Single `ScrollView`, `bg-background`, existing safe-area insets + bottom padding preserved.

**Identity block (centered):**

- Avatar 72px. Image or initials fallback styled `bg-brand` / `text-brand-foreground`.
- Name (bold, `text-foreground`).
- Role pill (`bg-muted` / `text-foreground`) — only when a role exists.
- Email (`text-muted-foreground`).
- "Edit Profile" outline button (`border-brand`, `text-brand`).
- Avatar + name + button all `Pressable` → `router.push('/(app)/personal-information')`.

**Group `ACCOUNT`** (rounded `bg-card`, divided rows, leading icon, trailing chevron):

- Personal Information → `/(app)/personal-information`
- Notifications → `/(app)/notification-settings`
- Privacy & Security → `/(app)/security` (MFA lives here)

**Group `PREFERENCES`:**

- Theme — inline existing `<ThemeToggle />` (no chevron)
- Help & Support → `Linking.openURL('mailto:support@rhkproperties.com')`, wrapped in try/catch (no-op if unsupported)
- Sign Out — destructive (`text-destructive` label + icon), confirm `Alert.alert` before running existing `handleSignOut`

## Components

Rewrite `ProfileScreen.tsx` in place. Extract two pure, props-driven presentational components in the same file:

- `SettingGroup` — renders an optional uppercase section label + a rounded `bg-card` container; maps children rows with dividers between them.
- `SettingRow` — `{ icon, label, onPress?, danger?, trailing? }`. `trailing` defaults to a chevron; pass a node (e.g. `<ThemeToggle/>`) to override; `danger` recolors to `text-destructive`.

Delete `StatCard`, `BRAND`, `BRAND_LIGHT`. Keep `getInitials`, `getDisplayName`, `handleSignOut` logic unchanged.

## MainHeader Change

[src/components/organisms/MainHeader.tsx](../../../src/components/organisms/MainHeader.tsx): wrap the avatar + greeting + name `View` in a `Pressable` → `router.push('/(app)/profile')` (`accessibilityRole="button"`). Notification bell `Pressable` unchanged.

## Error / Edge Handling

- No roles → role pill omitted entirely.
- No avatar image → existing `Avatar` initials fallback.
- No email → email line hidden.
- `mailto:` unsupported (rare) → caught, silent no-op.
- Sign Out: existing best-effort chain unchanged (push-token delete → `logoutUser` → socket disconnect → notifications reset → badge 0 → `clearAuth` → `router.replace('/(auth)/login')`); now gated behind a confirm dialog.

## Verification

No test runner in boh-mobile (project convention). Verify via:

1. `pnpm lint`
2. `npx tsc --noEmit`
3. Manual QA: light + dark theme; user with/without role; with/without avatar image; Edit Profile via avatar/name/button; each ACCOUNT + PREFERENCES row; Help & Support opens mail composer; Sign Out confirm + full logout; `MainHeader` avatar/name → profile.
