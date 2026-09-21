# Bottom Tabs Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stack-based tab navigation with a real expo-router `Tabs` navigator so tab switches stop remounting screens (the lag), the stack stops growing, and Android back behaves standardly.

**Architecture:** New `app/(tabs)/` group hosts the 7 tab-root screens under a `Tabs` navigator whose `tabBar` is the existing custom `BottomTabBar` (visuals unchanged). Detail screens stay in `(app)` / `(public)` stacks and push over the tabs. Data freshness on tab re-focus comes from two small hooks (refetch-stale / invalidate-stale).

**Tech Stack:** Expo SDK 54, expo-router ~6.0.23 (React Navigation 7), React Native 0.81, TanStack Query v5, NativeWind v4, Zustand.

**Spec:** `docs/superpowers/specs/2026-07-07-bottom-tabs-migration-design.md`

## Global Constraints

- **No test runner in this repo** (project convention — do NOT add one). Verification per task = `npx tsc --noEmit` clean + `pnpm lint` clean. Final task adds manual QA.
- **No new dependencies.** `@react-navigation/bottom-tabs` is already a transitive dep of expo-router and resolvable (pnpm `nodeLinker: hoisted`); type-only import from it is allowed.
- Package manager: **pnpm**. Prettier: single quotes, semis, 100-col, 2-space; `prettier-plugin-tailwindcss` sorts classes. Husky pre-commit runs lint-staged.
- Path aliases: `@/*` → `src/*`, `@theme` → `theme/index.ts`.
- Strict TypeScript; prefer `Readonly<{...}>` prop types.
- URLs must not change: `/`, `/listings`, `/leads`, `/calls`, `/chat`, `/favourites`, `/profile` (group folders are not part of the path).
- Typed-routes note: `.expo/types` regenerates when the dev server runs. After moving route files, if `tsc` reports route-string type errors, run `pnpm start` briefly (Ctrl-C after "Metro waiting"), then re-run `tsc`.
- Working branch: `feat/bottom-tabs-nav` (created in Task 1). `eas.json` has an unrelated uncommitted change on `feat/conversation-details-screen` — do not touch or commit it.

---

### Task 1: Branch + tab-focus refresh hooks

**Files:**

- Create: `src/lib/tab-focus-refresh.ts`

**Interfaces:**

- Produces: `useRefetchOnTabFocus(queries: readonly RefetchableQuery[]): void` where `RefetchableQuery = Readonly<{ isStale: boolean; refetch: () => unknown }>` (any `useQuery`/`useInfiniteQuery` result satisfies it).
- Produces: `useInvalidateOnTabFocus(keys: readonly QueryKey[]): void` — on tab re-focus, invalidates **stale, active** queries matching each key prefix.
- Both skip the first focus (initial mount) — the query just fetched then.

- [ ] **Step 1: Create branch**

```bash
git checkout -b feat/bottom-tabs-nav
```

- [ ] **Step 2: Write the hooks file**

Create `src/lib/tab-focus-refresh.ts`:

```ts
import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

// Tab screens stay mounted in the Tabs navigator, so `refetchOnMount` never
// fires on tab switches. These hooks restore freshness: when a tab regains
// focus, refetch its queries IF stale (staleTime default 30s). The first
// focus (initial lazy mount) is skipped — the query just fetched.

type RefetchableQuery = Readonly<{ isStale: boolean; refetch: () => unknown }>;

function useTabRefocus(onRefocus: () => void) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      onRefocus();
    }, [onRefocus]),
  );
}

/** Pass the full query results (not destructured) of the screen's main queries. */
export function useRefetchOnTabFocus(queries: readonly RefetchableQuery[]) {
  const ref = useRef(queries);
  ref.current = queries;
  useTabRefocus(
    useCallback(() => {
      for (const q of ref.current) {
        if (q.isStale) q.refetch();
      }
    }, []),
  );
}

/**
 * For screens whose queries live in child components (e.g. Home stat tiles):
 * invalidate stale active queries by key prefix on tab re-focus.
 */
export function useInvalidateOnTabFocus(keys: readonly QueryKey[]) {
  const queryClient = useQueryClient();
  const ref = useRef(keys);
  ref.current = keys;
  useTabRefocus(
    useCallback(() => {
      for (const key of ref.current) {
        queryClient
          .invalidateQueries({ queryKey: key, stale: true, refetchType: 'active' })
          .catch(() => {});
      }
    }, [queryClient]),
  );
}
```

- [ ] **Step 3: Verify compile + lint**

```bash
npx tsc --noEmit && pnpm lint
```

Expected: both exit 0 (file is not imported anywhere yet — that's fine).

- [ ] **Step 4: Commit**

```bash
git add src/lib/tab-focus-refresh.ts
git commit -m "feat(nav): add tab-focus refresh hooks for kept-alive tab screens"
```

---

### Task 2: Migration core — (tabs) navigator, route moves, BottomTabBar rewrite, layout cleanups

All changes in this task are compile-coupled (moving routes breaks the old wiring), so it is one task with a single commit at the end. Follow the steps in order.

**Files:**

- Create: `app/(tabs)/_layout.tsx`
- Move: `app/(public)/index.tsx` → `app/(tabs)/index.tsx` (content unchanged)
- Move: `app/(app)/listings/index.tsx` → `app/(tabs)/listings.tsx` (content unchanged)
- Move: `app/(app)/leads/index.tsx` → `app/(tabs)/leads.tsx` (content unchanged)
- Move: `app/(app)/calls/index.tsx` → `app/(tabs)/calls.tsx` (content unchanged)
- Move: `app/(app)/chat/index.tsx` → `app/(tabs)/chat.tsx` (content unchanged)
- Move: `app/(app)/favourites.tsx` → `app/(tabs)/favourites.tsx` (content unchanged)
- Move: `app/(app)/profile.tsx` → `app/(tabs)/profile.tsx` (content unchanged)
- Modify: `src/features/new-projects/components/BottomTabBar.tsx` (rewrite navigation wiring; keep visuals + exports)
- Modify: `app/_layout.tsx` (delete GlobalTabBar/TAB_PATHS, add `(tabs)` screen, restore slide animations, host AuthPromptModal)
- Modify: `app/(app)/_layout.tsx` (remove moved screen entries + their `animation: 'none'`)
- Modify: `app/(public)/_layout.tsx` (remove AuthPromptModal, now hosted at root)

**Interfaces:**

- Consumes: nothing from Task 1.
- Produces: `BottomTabBar` component now has props `Readonly<Pick<BottomTabBarProps, 'state' | 'navigation'>>` (type from `@react-navigation/bottom-tabs`). `useBottomTabBarSpace(gap?: number): number` and `BOTTOM_TAB_BAR_HEIGHT` exports unchanged — all existing consumers keep working.
- Tab route names inside the navigator: `index`, `listings`, `leads`, `calls`, `chat`, `favourites`, `profile`. "More" is NOT a route (button opens the sheet).

- [ ] **Step 1: Move the 7 route files**

```bash
git mv "app/(public)/index.tsx"        "app/(tabs)/index.tsx" 2>/dev/null || { mkdir -p "app/(tabs)" && git mv "app/(public)/index.tsx" "app/(tabs)/index.tsx"; }
git mv "app/(app)/listings/index.tsx"  "app/(tabs)/listings.tsx"
git mv "app/(app)/leads/index.tsx"     "app/(tabs)/leads.tsx"
git mv "app/(app)/calls/index.tsx"     "app/(tabs)/calls.tsx"
git mv "app/(app)/chat/index.tsx"      "app/(tabs)/chat.tsx"
git mv "app/(app)/favourites.tsx"      "app/(tabs)/favourites.tsx"
git mv "app/(app)/profile.tsx"         "app/(tabs)/profile.tsx"
```

File contents are unchanged — they are thin wrappers importing from `src/features/…` via `@/` aliases, which are path-independent.

- [ ] **Step 2: Create `app/(tabs)/_layout.tsx`**

```tsx
import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { BottomTabBar } from '@/features/new-projects/components/BottomTabBar';
import { MOBILE_BLOCKED_ROLES } from '@/lib/rbac';
import { hasAnyRole } from '@/lib/rbac/selectors';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  const { hasSeenOnboarding, loadOnboardingState } = useOnboardingStore();

  useEffect(() => {
    loadOnboardingState();
  }, [loadOnboardingState]);

  if (hasSeenOnboarding === null) return null;
  if (!hasSeenOnboarding) return <Redirect href="/(auth)/onboarding" />;

  // Blocked-roles gate mirrors (app)/_layout. NO isAuthenticated redirect here:
  // home (index) is public; authed-only tabs carry their own guards.
  if (
    user &&
    !user.hasAllAccess &&
    MOBILE_BLOCKED_ROLES.length > 0 &&
    hasAnyRole(user, MOBILE_BLOCKED_ROLES)
  ) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <BottomTabBar state={props.state} navigation={props.navigation} />}
      screenOptions={{ headerShown: false, lazy: true, freezeOnBlur: true }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="listings" />
      <Tabs.Screen name="leads" />
      <Tabs.Screen name="calls" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="favourites" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
```

- [ ] **Step 3: Rewrite `BottomTabBar.tsx` navigation wiring**

Full new content for `src/features/new-projects/components/BottomTabBar.tsx`. Visuals (TabButton, colors, spring animation, dot) are IDENTICAL to the current file — only the navigation plumbing changes: props from the navigator, `route` names instead of `href`s, `navigation.navigate` + `tabPress` emit instead of `router.navigate`, no `optimisticTab`/`usePathname`/`pathnameToTab`, and the bar wraps itself in the absolute-positioned overlay container (previously done by `GlobalTabBar` in the root layout).

```tsx
import { View, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text } from '@/components/atoms/Text';
import { Icon } from '@/components/atoms/Icon';
import { Dot } from '@/components/atoms/Dot';
import { useApprovalsPendingCount } from '@/features/approvals/hooks/use-approvals-pending-count';
import { PERMISSIONS, useCan, useRole } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth.store';
import { useAuthPromptStore } from '@/store/auth-prompt.store';
import { useMoreSheetStore } from '@/store/more-sheet.store';
import { useTheme, useThemeColor } from '@theme';
import * as icons from 'lucide-react-native/icons';

type IconName = keyof typeof icons;

interface TabItem {
  key: string;
  label: string;
  icon: IconName;
  /** Route name inside the (tabs) navigator. Empty for non-route buttons (More). */
  route: string;
  requiresAuth?: boolean;
}

const AUTHED_TABS: TabItem[] = [
  { key: 'home', label: 'Home', icon: 'House', route: 'index' },
  { key: 'listings', label: 'Listings', icon: 'List', route: 'listings' },
  { key: 'leads', label: 'Leads', icon: 'Users', route: 'leads' },
  { key: 'calls', label: 'Calls', icon: 'Phone', route: 'calls' },
  { key: 'chat', label: 'Chat', icon: 'MessageCircle', route: 'chat' },
  { key: 'more', label: 'More', icon: 'Menu', route: '' },
];

const PUBLIC_TABS: TabItem[] = [
  { key: 'home', label: 'Home', icon: 'House', route: 'index' },
  {
    key: 'favourites',
    label: 'Favourites',
    icon: 'Heart',
    route: 'favourites',
    requiresAuth: true,
  },
  { key: 'profile', label: 'Profile', icon: 'User', route: 'profile', requiresAuth: true },
];

const CUSTOMER_TABS: TabItem[] = [
  { key: 'home', label: 'Home', icon: 'House', route: 'index' },
  { key: 'favourites', label: 'Favourites', icon: 'Heart', route: 'favourites' },
  { key: 'profile', label: 'Profile', icon: 'User', route: 'profile' },
];

const BAR_HEIGHT = 60;
const ICON_SIZE = 24;

// Docked bar height (without safe-area inset). Screens that scroll under the bar
// should reserve `useBottomTabBarSpace()` worth of bottom padding.
export const BOTTOM_TAB_BAR_HEIGHT = BAR_HEIGHT;

export function useBottomTabBarSpace(gap = 0): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + insets.bottom + gap;
}

function TabButton({
  tab,
  active,
  onPress,
  activeColor,
  inactiveColor,
  showDot = false,
}: Readonly<{
  tab: TabItem;
  active: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  showDot?: boolean;
}>) {
  const color = active ? activeColor : inactiveColor;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      // Spring bounce is cosmetic only — runs on the UI thread, never gates nav.
      onPressIn={() => {
        scale.value = withSpring(0.85, { damping: 12, stiffness: 400, mass: 0.4 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 9, stiffness: 320, mass: 0.5 });
      }}
      style={{
        flex: 1,
        height: BAR_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={tab.label}
    >
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, animatedStyle]}>
        <View>
          <Icon name={tab.icon} size={ICON_SIZE} color={color} strokeWidth={active ? 2.6 : 2} />
          {showDot ? <Dot className="absolute -right-1.5 -top-0.5" /> : null}
        </View>
        <Text
          numberOfLines={1}
          className="text-[11px]"
          style={{ color, fontWeight: active ? '600' : '400' }}
        >
          {tab.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function BottomTabBar({
  state,
  navigation,
}: Readonly<Pick<BottomTabBarProps, 'state' | 'navigation'>>) {
  const insets = useSafeAreaInsets();

  const { colorScheme } = useTheme();
  const primary = useThemeColor('--primary');
  const mutedFg = useThemeColor('--muted-foreground');
  const surface = useThemeColor('--surface');
  const border = useThemeColor('--border');
  // Pure white on light mode; themed surface on dark.
  const barBg = colorScheme === 'dark' ? surface : '#ffffff';

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isClient, isCustomer } = useRole();
  const openAuthPrompt = useAuthPromptStore((s) => s.open);

  const { count: approvalsPending } = useApprovalsPendingCount();

  const canListings = useCan(PERMISSIONS.LISTINGS_READ);
  const canLeads = useCan([PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_READ_ALL]);
  const canChat = useCan(PERMISSIONS.CHAT_READ);
  const canCalls = useCan(PERMISSIONS.CALLS_MONITOR);

  let TABS: TabItem[];
  if (!isAuthenticated) {
    TABS = PUBLIC_TABS;
  } else if (isClient || isCustomer) {
    // userType first: backend stamps self-service signups as `client` (the
    // end-user persona) → favourites/home/profile only. `isCustomer` kept as a
    // role fallback. Any other userType falls through to role/permission gating.
    TABS = CUSTOMER_TABS;
  } else {
    const tabPermission: Record<string, boolean> = {
      listings: canListings,
      leads: canLeads,
      home: true,
      calls: canCalls,
      chat: canChat,
      more: true,
    };
    TABS = AUTHED_TABS.filter((t) => tabPermission[t.key] !== false);
  }

  // Active tab comes straight from navigator state — synchronous on tab press,
  // no optimistic-highlight workaround needed.
  const activeRouteName = state.routes[state.index]?.name;
  const activeKey = activeRouteName === 'index' ? 'home' : activeRouteName;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: barBg,
          borderTopWidth: 1,
          borderTopColor: border,
        }}
      >
        {TABS.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            active={tab.key === activeKey}
            activeColor={primary}
            inactiveColor={mutedFg}
            showDot={tab.key === 'more' && approvalsPending > 0}
            onPress={() => {
              if (!isAuthenticated && tab.requiresAuth) {
                openAuthPrompt();
                return;
              }
              if (tab.key === 'more') {
                useMoreSheetStore.getState().present();
                return;
              }
              const route = state.routes.find((r) => r.name === tab.route);
              const event = navigation.emit({
                type: 'tabPress',
                target: route?.key,
                canPreventDefault: true,
              });
              if (tab.key !== activeKey && !event.defaultPrevented) {
                navigation.navigate(tab.route);
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}
```

Notes for the implementer:

- The `useMemo` around TABS was dropped deliberately — it recomputed on every dep change anyway and the plain conditional is clearer. Everything else in the render body is identical to the old file.
- `navigation.navigate(name)` inside a tab navigator performs a jump-to-tab (React Navigation converts it); the `tabPress` emit keeps default behaviors (e.g. future scroll-to-top listeners) working like a native tab bar.

- [ ] **Step 4: Root `app/_layout.tsx` cleanup**

Four edits (rest of the file untouched):

4a. Delete the `TAB_PATHS` constant, the `onAuthOnlyRoute` function, and the whole `GlobalTabBar` component (currently lines ~51–93).

4b. Replace the `BottomTabBar` import with `AuthPromptModal`:

```tsx
// DELETE this line:
import { BottomTabBar } from '../src/features/new-projects/components/BottomTabBar';
// ADD this line:
import { AuthPromptModal } from '../src/features/auth/components/AuthPromptModal';
```

4c. In the root `<Stack>`, register `(tabs)` and drop the `animation: 'none'` overrides (they existed only to make cross-group tab taps look instant; detail pushes now get the normal slide):

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="(auth)" />
  <Stack.Screen name="(tabs)" />
  <Stack.Screen name="(public)" />
  <Stack.Screen name="(app)" />
</Stack>
```

4d. Replace `<GlobalTabBar />` (just below the Stack's closing `</View>`) with `<AuthPromptModal />` — the guest sign-in prompt must be mounted globally now that guest tabs live in `(tabs)`.

- [ ] **Step 5: `app/(app)/_layout.tsx` cleanup**

Remove the `Stack.Screen` entries for routes that moved to `(tabs)` (and their `animation: 'none'` options — those roots no longer live here):

```tsx
// DELETE these lines:
<Stack.Screen name="listings/index" options={{ animation: 'none' }} />
<Stack.Screen name="leads/index" options={{ animation: 'none' }} />
<Stack.Screen name="chat/index" options={{ animation: 'none' }} />
<Stack.Screen name="favourites" options={{ animation: 'none' }} />
<Stack.Screen name="profile" options={{ animation: 'none' }} />
<Stack.Screen name="calls/index" options={{ animation: 'none' }} />
```

Keep everything else: the auth/onboarding/blocked-roles gate and all remaining screen entries (`listings/sell`, `calls/[uuid]`, modals, …) still guard the detail screens that stayed in `(app)`.

- [ ] **Step 6: `app/(public)/_layout.tsx` cleanup**

`AuthPromptModal` moved to root. New full content:

```tsx
import { Stack } from 'expo-router';

export default function PublicLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 7: Verify compile + lint**

```bash
npx tsc --noEmit && pnpm lint
```

Expected: exit 0. If tsc complains about route-string types (stale `.expo/types` after the moves), run `pnpm start`, wait for Metro to be ready, Ctrl-C, re-run.

- [ ] **Step 8: Smoke-run**

```bash
pnpm ios   # or: pnpm android
```

Expected: app boots to Home; bar visible; tapping Listings/Leads/Calls/Chat switches instantly on revisit (first visit builds the tab); opening a listing detail slides over and covers the bar; Android hardware back from a non-home tab goes Home, then exits.

- [ ] **Step 9: Commit**

```bash
git add -A -- "app/(tabs)" "app/(public)" "app/(app)" app/_layout.tsx src/features/new-projects/components/BottomTabBar.tsx
git commit -m "feat(nav): migrate bottom tabs to expo-router Tabs navigator

Tab roots move into a (tabs) group under a real Tabs navigator with the
existing BottomTabBar as custom tabBar. Screens mount lazily and stay
alive (freezeOnBlur), fixing per-tap remount lag, unbounded stack
growth, and non-standard Android back behavior. Removes the
optimisticTab and TAB_PATHS/GlobalTabBar workarounds."
```

---

### Task 3: Auth guards for favourites + profile tabs

Moved out of `(app)`, these two lost its blanket auth gate. The bar hides them from guests, but direct deep links must not render them signed-out.

**Files:**

- Modify: `app/(tabs)/favourites.tsx`
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**

- Consumes: `useAuthStore` (`@/store/auth.store`), `Redirect` (expo-router).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Guard `app/(tabs)/favourites.tsx`**

The file's default export is the screen component. Add imports and an early return at the very top of the component body:

```tsx
// add to imports:
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
```

```tsx
// first lines inside the default-export component:
const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
if (!isAuthenticated) return <Redirect href="/" />;
```

Note: hooks that already exist in the component must not end up conditionally-called — place the `useAuthStore` line with the other hooks at the top, and the `if (!isAuthenticated)` return AFTER all hook calls in that component (React rules-of-hooks; eslint will flag it otherwise).

- [ ] **Step 2: Guard `app/(tabs)/profile.tsx`**

Current content is a bare re-export. Replace the whole file:

```tsx
import { Redirect } from 'expo-router';
import { ProfileScreen } from '@/features/profile/components/ProfileScreen';
import { useAuthStore } from '@/store/auth.store';

export default function ProfileRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Redirect href="/" />;
  return <ProfileScreen />;
}
```

(`ProfileScreen` is a named export — the old route file was `export { ProfileScreen as default } from '@/features/profile/components/ProfileScreen';` — so the named import above is correct.)

- [ ] **Step 3: Verify compile + lint**

```bash
npx tsc --noEmit && pnpm lint
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/favourites.tsx" "app/(tabs)/profile.tsx"
git commit -m "feat(nav): guard favourites/profile tabs for signed-out deep links"
```

---

### Task 4: Wire tab-focus data refresh into tab screens

Tabs stay mounted now, so `refetchOnMount: 'always'` no longer fires on tab switches. Apply the Task 1 hooks so each tab silently refreshes stale data (>30s) when re-focused. Listings tab is skipped — its landing screen has no queries (static cards).

**Files:**

- Modify: `src/features/leads/components/dashboard/overview/OverviewView.tsx`
- Modify: `src/features/chat/components/ChatInboxScreen.tsx`
- Modify: `src/features/callMonitoring/components/CallMonitoringScreen.tsx`
- Modify: `app/(tabs)/favourites.tsx`
- Modify: `src/features/home/components/HomeDashboardScreen.tsx`

**Interfaces:**

- Consumes: `useRefetchOnTabFocus`, `useInvalidateOnTabFocus` from `@/lib/tab-focus-refresh` (Task 1); `attendanceKeys` from `@/features/attendance/hooks/keys`.

- [ ] **Step 1: Leads tab — `OverviewView.tsx`**

Current line: `const { data, isLoading, isError, refetch } = useLeadsOverview();`

Replace with:

```tsx
const overviewQuery = useLeadsOverview();
const { data, isLoading, isError, refetch } = overviewQuery;
useRefetchOnTabFocus([overviewQuery]);
```

Add import: `import { useRefetchOnTabFocus } from '@/lib/tab-focus-refresh';`

Note: `useFocusEffect` works in any component under the tab screen (navigation context), so applying it inside `OverviewView` (a child of the leads tab screen) is correct.

- [ ] **Step 2: Chat tab — `ChatInboxScreen.tsx`**

Current line (~24): `const { data, isLoading, isError, refetch, isRefetching } = useChatInbox(tab);`

Replace with:

```tsx
const inboxQuery = useChatInbox(tab);
const { data, isLoading, isError, refetch, isRefetching } = inboxQuery;
useRefetchOnTabFocus([inboxQuery]);
```

Add import: `import { useRefetchOnTabFocus } from '@/lib/tab-focus-refresh';`

- [ ] **Step 3: Calls tab — `CallMonitoringScreen.tsx`**

Below the existing `const recordsQuery = useCallRecords(serverFilters);` (~line 55), add:

```tsx
useRefetchOnTabFocus([recordsQuery]);
useInvalidateOnTabFocus([['call-stats']]);
```

(`['call-stats']` prefix covers both the global and scoped stats queries, whose results are destructured to `data` only.)

Add import: `import { useRefetchOnTabFocus, useInvalidateOnTabFocus } from '@/lib/tab-focus-refresh';`

- [ ] **Step 4: Favourites tab — `app/(tabs)/favourites.tsx`**

Below the existing lines `const projects = useFavoriteProjectsList();` / `const listings = useFavoriteListingsList();`, add:

```tsx
useRefetchOnTabFocus([projects, listings]);
```

Add import: `import { useRefetchOnTabFocus } from '@/lib/tab-focus-refresh';`

Careful: this must come BEFORE the Task 3 `if (!isAuthenticated) return <Redirect ...>` early return if that return was placed after the query hooks — all hooks stay above the early return (rules-of-hooks).

- [ ] **Step 5: Home tab — `HomeDashboardScreen.tsx`**

Home's queries live in child components (`HomeStatTiles`, `LeadsInsightsSection`, `AttendanceWidget`), so use the key-prefix variant. Inside `HomeDashboardScreen`, alongside the other hooks:

```tsx
useInvalidateOnTabFocus([
  ['leads', 'overview'],
  ['leads', 'funnel-stats'],
  ['call-stats', 'global'],
  attendanceKeys.today(),
]);
```

Add imports:

```tsx
import { useInvalidateOnTabFocus } from '@/lib/tab-focus-refresh';
import { attendanceKeys } from '@/features/attendance/hooks/keys';
```

(Key prefixes verified against the codebase: `['leads', 'overview', params]` in use-leads-overview.ts, `['leads', 'funnel-stats']` in use-funnel-stats.ts invalidations, `['call-stats', 'global', range]` in use-call-stats.ts, `attendanceKeys.today()` = `['attendance', 'today']`.)

- [ ] **Step 6: Verify compile + lint**

```bash
npx tsc --noEmit && pnpm lint
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/features/leads/components/dashboard/overview/OverviewView.tsx src/features/chat/components/ChatInboxScreen.tsx src/features/callMonitoring/components/CallMonitoringScreen.tsx "app/(tabs)/favourites.tsx" src/features/home/components/HomeDashboardScreen.tsx
git commit -m "feat(nav): refresh stale queries on tab re-focus"
```

---

### Task 5: Full verification (manual QA)

No test runner in this repo — this task is the release gate. Run on iOS simulator AND an Android emulator/device.

**Files:** none (verification only).

- [ ] **Step 1: Static checks**

```bash
npx tsc --noEmit && pnpm lint
```

Expected: exit 0 for both.

- [ ] **Step 2: Manual QA — run each flow, tick when verified**

```bash
pnpm ios      # then repeat the list below on: pnpm android
```

- [ ] Tab switching: first visit to each tab builds it (brief), every revisit is instant (no rebuild, no spinner)
- [ ] Android hardware back: non-home tab → Home → exit; from a pushed detail screen → back pops to the tab (bar reappears)
- [ ] Guest flow: only Home/Favourites/Profile tabs visible; tapping Favourites/Profile opens the auth prompt (modal renders — it's now mounted at root); after sign-in, staff tabs appear
- [ ] Role sets: staff sees Home/Listings/Leads/Calls/Chat/More (minus tabs their permissions hide); client/customer sees Home/Favourites/Profile
- [ ] More button opens the sheet; approvals-pending dot renders on More when count > 0
- [ ] Create-lead FAB and create-listing FAB float above the bar (useBottomTabBarSpace positioning intact)
- [ ] Detail screens (listing detail, lead detail, chat conversation, call detail) slide over and fully cover the bar
- [ ] Push-notification deep links (send test notifications or trigger via backend): lead detail `/leads/:id`, listing detail `/listings/:id`, wizard edit, list fallbacks `/leads` + `/listings` — each lands correctly with tabs intact underneath
- [ ] Onboarding: fresh install (or clear AsyncStorage) → onboarding shows before tabs
- [ ] Biometric lock (if enabled on test account) still covers the app on cold start
- [ ] Minimized call: top call bar reserves space, tabs still work below it
- [ ] Data freshness: open Leads, switch to Chat, wait >30s, switch back to Leads → data silently refetches (watch network logs screen or Metro logs); switching back within 30s does NOT refetch
- [ ] Chat: no duplicate message handling after backgrounding the chat tab (WebSocket listeners not duplicated — send a test message, confirm it appears once)
- [ ] Theme toggle: bar colors correct in light + dark
- [ ] Low-end Android sanity: with all 7 tabs visited, app stays responsive (freeze + lazy working)

- [ ] **Step 3: Fix anything that fails, re-run the affected QA items, then final commit if fixes were made**

Any fix follows the same cycle: edit → `npx tsc --noEmit && pnpm lint` → re-verify the QA item → commit with a `fix(nav): …` message.
