# RBAC integration guide

How to gate new routes, screens, and actions in boh-mobile. Read before adding any feature.

## Module

All RBAC primitives live at [`src/lib/rbac/`](./). Import from the barrel:

```ts
import {
  Can,
  PERMISSIONS,
  ROLES,
  RoleGuard,
  useCan,
  useCanAll,
  useRole,
  useRequirePermission,
} from '@/lib/rbac';
```

Data lives on the auth store (`useAuthStore`) — `user.roles[]`, `user.permissions[]`, `user.hasAllAccess`. Hydrated from SecureStore on cold start, refreshed by `usePermissionSync` (mounted once in [`app/_layout.tsx`](../../../app/_layout.tsx)) on app foreground + login. Don't read these fields manually — go through the helpers below.

## Permission codes

Format: `resource:action` (e.g. `leads:read`, `projects:publish`).

Source of truth: backend seed [`boh-lead-magnet-backend/prisma/seed/core-permissions.ts`](../../../../boh-lead-magnet-backend/prisma/seed/core-permissions.ts).

Mirror lives at [`permissions.ts`](./permissions.ts). When backend adds a permission:

1. Add the matching entry to `PERMISSIONS` (UPPER_SNAKE key, `'resource:action'` value).
2. Use `PERMISSIONS.MY_NEW_CODE` — never raw strings. Typos won't fail at compile-time otherwise.
3. **Backend has NO `delete` action** — soft-delete via `update`. Don't invent `*:delete`.
4. Note the `_all` split: `leads:read` (own/assigned) vs `leads:read_all` (everyone). Gate broad-scope UI on `_all`.

## Role codes

Backend uses **hyphens**, not underscores: `super-admin`, `end-user`. See [`roles.ts`](./roles.ts).

`hasAllAccess: true` on the user is the super-admin bypass — every `useCan`/`Can` returns true. Don't add manual `isSuperAdmin` checks; the selectors handle it.

## Gating recipes

### 1. New route / screen — block deep-link access

For any screen that requires a permission, gate at the **route file** (top of `app/(app)/.../page.tsx`):

```tsx
// app/(app)/leads/index.tsx
import { Redirect } from 'expo-router';
import { LeadsScreen } from '@/features/leads/components/LeadsScreen';
import { PERMISSIONS, useRequirePermission } from '@/lib/rbac';

export default function LeadsRoute() {
  const state = useRequirePermission([PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_READ_ALL]);
  if (state === 'loading') return null; // hide during cold-start hydration
  if (state === 'denied') return <Redirect href="/" />;
  return <LeadsScreen />;
}
```

`useRequirePermission` returns `'loading' | 'allowed' | 'denied'`. The loading state prevents a one-frame redirect flicker while perms hydrate.

**Always-open routes** (no gate): `/`, `/profile`. Profile must work for every authed user — don't gate it.

### 2. Bottom-tab visibility

If your new route should appear as a tab, edit [`BottomTabBar.tsx`](../../features/new-projects/components/BottomTabBar.tsx):

1. Add the tab to `AUTHED_TABS`.
2. Add a `useCan(...)` call at the top of `BottomTabBar` (hooks must be unconditional — don't put them inside the `useMemo`).
3. Add the tab key → boolean entry to the `tabPermission` map inside `TABS` `useMemo`.

Tab bar animation array is sized to `MAX_TABS = 5`. If you exceed that, bump the constant **and** the parallel `useSharedValue` declarations (`p0..p4`, `w0..w4`, `s0..s4`) — they can't be created dynamically.

### 3. Action button / menu item

Wrap with `<Can>`:

```tsx
import { Can, PERMISSIONS } from '@/lib/rbac';

<Can permission={PERMISSIONS.LEADS_CREATE}>
  <Button onPress={openCreateModal}>New lead</Button>
</Can>;
```

Variants:

```tsx
<Can anyOf={[PERMISSIONS.LEADS_UPDATE, PERMISSIONS.LEADS_UPDATE_ALL]}>...</Can>
<Can allOf={[PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_ASSIGN]}>...</Can>
<Can permission={PERMISSIONS.LEADS_ASSIGN} fallback={<DisabledHint />}>...</Can>
```

Default `fallback` is `null` (hide entirely — the project's chosen UX). Override only if you have a reason to show a disabled state.

### 4. Conditional content / labels

For text or logic forks, use the hook:

```tsx
const canSeeAll = useCan(PERMISSIONS.LEADS_READ_ALL);
const title = canSeeAll ? 'All Leads' : 'My Leads';

const { isAdmin, isAgent, hasAllAccess } = useRole();
```

`useRole()` is a convenience for role-flavored UI; prefer `useCan()` for actual capability checks (permissions are more granular and survive role rename).

### 5. Role-based block (rare)

Use only when a permission code can't express the rule (e.g. shell-level personas). Edit [`MOBILE_BLOCKED_ROLES`](./roles.ts) — it's a deny-list applied in [`app/(app)/_layout.tsx`](<../../../app/(app)/_layout.tsx>). Currently empty; backend has no mobile-blocked persona yet. **Don't switch back to an allow-list** — that's what caused the profile-bounce bug.

## Pitfalls

| Mistake                                                       | Symptom                                    | Fix                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Raw string `'leads:read'` instead of `PERMISSIONS.LEADS_READ` | Typo passes lint, silently denies access   | Always import from `PERMISSIONS`                                                                      |
| Role code `'super_admin'` (underscore)                        | Super-admin treated as no-role             | Backend uses `super-admin` (hyphen) — see `ROLES`                                                     |
| Gating profile/home routes                                    | Tab clicks bounce                          | Leave them open; permission is irrelevant                                                             |
| Putting `useCan` inside `useMemo` / conditionals              | React hooks rule violation                 | Call hooks unconditionally at top of component                                                        |
| Adding `*:delete` permission code                             | Backend will 403                           | Backend uses soft-delete via `update`                                                                 |
| Skipping `'loading'` state in route guards                    | One-frame flicker → redirect on cold start | Always handle the 3 states: `loading`/`allowed`/`denied`                                              |
| Frontend-only check, no backend perm                          | UI hides button but API still callable     | Backend `PermissionsGuard` is authoritative — always have a matching `@RequirePermission` server-side |

## Verification checklist

After adding gates:

1. `pnpm exec tsc --noEmit` — types clean.
2. `pnpm lint` — no new errors.
3. Sign in as super-admin — every gated UI renders.
4. Sign in as a role missing the permission — gated UI is absent (not greyed).
5. Deep-link to the route directly (paste path in dev tools) — should redirect to `/`.
6. Background app 5 min, foreground — `usePermissionSync` re-fetches; revoked perms disappear within one cycle (60s debounce).

## See also

- Backend RBAC engine: [`boh-lead-magnet-backend/src/rbac/`](../../../../boh-lead-magnet-backend/src/rbac/)
- Permission catalog: [`core-permissions.ts`](../../../../boh-lead-magnet-backend/prisma/seed/core-permissions.ts)
- Role seed: [`roles.ts`](../../../../boh-lead-magnet-backend/prisma/seed/roles.ts)
- Profile endpoint (data source): `GET /api/v1/auth/profile` → [`auth.controller.ts:221`](../../../../boh-lead-magnet-backend/src/modules/auth/auth.controller.ts#L221)
