# Mobile Profile Page Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the off-theme, fake-data profile page with a clean theme-driven "Centered Avatar" layout showing only real `User` data, and make the global header's avatar+name open the profile page.

**Architecture:** Rewrite `ProfileScreen.tsx` in place with two in-file presentational subcomponents (`SettingGroup`, `SettingRow`). All color via NativeWind semantic tokens (no hex). Identity area and an explicit "Edit Profile" button route to the existing personal-information screen. `MainHeader` gets its identity block wrapped in a `Pressable` to the profile route. Sub-pages and the sign-out chain are untouched (sign-out only gains a confirm dialog).

**Tech Stack:** Expo Router, React Native 0.81, NativeWind v4, Zustand auth store, lucide-react-native icons.

**Spec:** `docs/superpowers/specs/2026-05-18-mobile-profile-revamp-design.md`

> **Testing note:** boh-mobile has **no test runner** (project convention in `CLAUDE.md`; confirmed user preference). The standard TDD steps are replaced with a fixed verification gate per task: `npx tsc --noEmit` → `pnpm lint` → manual QA. This overrides the writing-plans TDD default per project convention.

---

## File Structure

- **Modify (full rewrite):** `src/features/profile/components/ProfileScreen.tsx` — identity block + setting groups + `SettingGroup`/`SettingRow` subcomponents. Single focused file (~150 lines).
- **Modify:** `src/components/organisms/MainHeader.tsx` — wrap identity block in `Pressable` to profile route.
- Route file `app/(app)/profile.tsx` (one-line re-export) — **unchanged**.

---

### Task 1: Rewrite ProfileScreen

**Files:**

- Modify (replace entire file): `src/features/profile/components/ProfileScreen.tsx`

- [ ] **Step 1: Replace the full contents of `src/features/profile/components/ProfileScreen.tsx`**

```tsx
import { type ReactNode } from 'react';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { ThemeToggle } from '@/components/atoms/ThemeToggle';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';
import { logoutUser } from '@/features/auth/services';
import { deleteDeviceToken } from '@/features/notifications/services';
import { useNotificationsStore } from '@/features/notifications/store/notifications.store';
import { getExpoPushToken, setBadgeCount } from '@/lib/push-notifications';
import { disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types/auth.types';

const SUPPORT_EMAIL = 'support@rhkproperties.com';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getDisplayName(user: User | null): string {
  if (!user) return 'Agent Name';
  const fullName = user.profile?.fullName?.trim();
  if (fullName) return fullName;
  const first = user.profile?.firstName?.trim() ?? '';
  const last = user.profile?.lastName?.trim() ?? '';
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  return user.email ?? 'Agent Name';
}

interface SettingRowProps {
  icon: IconName;
  label: string;
  onPress?: () => void;
  danger?: boolean;
  trailing?: ReactNode;
  divider?: boolean;
}

function SettingRow({
  icon,
  label,
  onPress,
  danger,
  trailing,
  divider,
}: Readonly<SettingRowProps>) {
  const destructive = useThemeColor('--destructive');
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={cn(
        'flex-row items-center gap-3 px-4 py-4 active:opacity-70',
        divider && 'border-b border-border',
      )}
    >
      <Icon name={icon} size={20} color={danger ? destructive : undefined} />
      <Text className={cn('flex-1 text-sm font-medium', danger && 'text-destructive')}>
        {label}
      </Text>
      {trailing ?? (onPress && !danger ? <Icon name="ChevronRight" size={16} /> : null)}
    </Pressable>
  );
}

interface SettingGroupProps {
  label?: string;
  children: ReactNode;
}

function SettingGroup({ label, children }: Readonly<SettingGroupProps>) {
  return (
    <View>
      {label ? (
        <Text className="mb-2 mt-6 px-5 text-xs font-bold tracking-widest text-muted-foreground">
          {label}
        </Text>
      ) : null}
      <View className="mx-4 overflow-hidden rounded-2xl bg-card">{children}</View>
    </View>
  );
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const tokens = useAuthStore((s) => s.tokens);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const name = getDisplayName(user);
  const initials = getInitials(name);
  const email = user?.email ?? '';
  const role = user?.roles?.[0]?.name ?? '';
  const profilePicUrl = user?.profile?.profilePicUrl ?? null;

  const goEditProfile = () => router.push('/(app)/personal-information');

  async function handleSignOut() {
    // Unregister this device's push token while the auth header is still
    // valid (before clearAuth nulls it). Best-effort.
    try {
      const pushToken = await getExpoPushToken();
      if (pushToken) {
        await deleteDeviceToken(pushToken);
      }
    } catch {
      // non-fatal
    }
    try {
      await logoutUser(tokens?.refreshToken);
    } catch {
      // Best-effort: clear local session even if server call fails.
    } finally {
      disconnectSocket();
      useNotificationsStore.getState().resetNotifications();
      void setBadgeCount(0);
      clearAuth();
      router.replace('/(auth)/login');
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void handleSignOut() },
    ]);
  }

  async function openSupport() {
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
    } catch {
      // Mail client unavailable — silent no-op.
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: 120 + insets.bottom,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Identity */}
      <View className="items-center px-4">
        <Pressable
          onPress={goEditProfile}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          className="items-center active:opacity-80"
        >
          <Avatar alt={name} className="h-20 w-20">
            {profilePicUrl ? <AvatarImage source={{ uri: profilePicUrl }} /> : null}
            <AvatarFallback textClassName="text-2xl">
              <Text>{initials}</Text>
            </AvatarFallback>
          </Avatar>
          <Text className="mt-3 text-xl font-bold text-foreground">{name}</Text>
        </Pressable>

        {role ? (
          <View className="mt-2 rounded-full bg-muted px-3 py-1">
            <Text className="text-xs font-semibold text-foreground">{role}</Text>
          </View>
        ) : null}

        {email ? <Text className="mt-2 text-sm text-muted-foreground">{email}</Text> : null}

        <Pressable
          onPress={goEditProfile}
          accessibilityRole="button"
          className="mt-4 rounded-full border border-brand px-6 py-2.5 active:opacity-70"
        >
          <Text className="text-sm font-bold text-brand">Edit Profile</Text>
        </Pressable>
      </View>

      {/* Account */}
      <SettingGroup label="ACCOUNT">
        <SettingRow icon="UserRound" label="Personal Information" onPress={goEditProfile} divider />
        <SettingRow
          icon="Bell"
          label="Notifications"
          onPress={() => router.push('/(app)/notification-settings')}
          divider
        />
        <SettingRow
          icon="Shield"
          label="Privacy & Security"
          onPress={() => router.push('/(app)/security')}
        />
      </SettingGroup>

      {/* Preferences */}
      <SettingGroup label="PREFERENCES">
        <SettingRow icon="Palette" label="Theme" trailing={<ThemeToggle />} divider />
        <SettingRow
          icon="LifeBuoy"
          label="Help & Support"
          onPress={() => void openSupport()}
          divider
        />
        <SettingRow icon="LogOut" label="Sign Out" danger onPress={confirmSignOut} />
      </SettingGroup>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Confirm `Icon` exports `IconName`**

Run: `grep -n "export type IconName" src/components/atoms/Icon.tsx`
Expected: one match (`export type IconName = keyof typeof icons;`). It exists — no change needed.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors referencing `ProfileScreen.tsx`. `IconName` covers `UserRound`, `Bell`, `Shield`, `Palette`, `LifeBuoy`, `LogOut`, `ChevronRight` (all verified valid lucide keys).

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: exits 0, no errors in `ProfileScreen.tsx`. (`sonarjs` cognitive-complexity cap is 20; this file is well under.)

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/components/ProfileScreen.tsx
git commit -m "$(cat <<'EOF'
feat(profile): theme-driven centered-avatar profile page

Remove hard-coded purple brand, fake stats grid, fake badges and
Business Hub card. Show only real User data (avatar/name/role/email).
Identity + Edit Profile button route to personal-information. Sign Out
now confirms; Help & Support opens mailto:support@rhkproperties.com.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Make MainHeader identity tappable

**Files:**

- Modify: `src/components/organisms/MainHeader.tsx`

- [ ] **Step 1: Add the `router` import**

In `src/components/organisms/MainHeader.tsx`, add this import after the existing `expo-router`-free imports (top of file, with the other imports):

```tsx
import { router } from 'expo-router';
```

- [ ] **Step 2: Wrap the identity block in a Pressable**

Replace this block:

```tsx
<View className="flex-row items-center gap-3">
  <Avatar alt={fullName} className="h-11 w-11">
    {photoUrl ? <AvatarImage source={{ uri: photoUrl }} /> : null}
    <AvatarFallback>
      <Text>{getInitials(fullName)}</Text>
    </AvatarFallback>
  </Avatar>
  <View>
    <Text className="text-xs text-muted-foreground">{greeting()}</Text>
    <Text className="text-base font-bold text-foreground">{fullName}!</Text>
  </View>
</View>
```

with:

```tsx
<Pressable
  onPress={() => router.push('/(app)/profile')}
  accessibilityRole="button"
  accessibilityLabel="Open profile"
  className="flex-row items-center gap-3 active:opacity-70"
>
  <Avatar alt={fullName} className="h-11 w-11">
    {photoUrl ? <AvatarImage source={{ uri: photoUrl }} /> : null}
    <AvatarFallback>
      <Text>{getInitials(fullName)}</Text>
    </AvatarFallback>
  </Avatar>
  <View>
    <Text className="text-xs text-muted-foreground">{greeting()}</Text>
    <Text className="text-base font-bold text-foreground">{fullName}!</Text>
  </View>
</Pressable>
```

(`Pressable` is already imported in this file — verify with `grep -n "Pressable" src/components/organisms/MainHeader.tsx`; it is used by the notification button.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/organisms/MainHeader.tsx
git commit -m "$(cat <<'EOF'
feat(header): tap avatar+name in MainHeader to open profile

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Manual QA

**Files:** none (verification only)

- [ ] **Step 1: Start the app**

Run: `pnpm ios` (or `pnpm android`)
Expected: app builds and launches, signed-in user lands on a tab screen.

- [ ] **Step 2: Run the QA checklist**

Verify each, on both light and dark theme:

- Profile page uses theme colors only — no purple anywhere.
- Avatar shows profile image when present, initials fallback otherwise (`bg-brand`).
- Name, email, role pill show real values. **A user with no roles shows no role pill** (test by inspecting a no-role account or temporarily forcing `roles: []`).
- Tapping the avatar, the name, "Edit Profile" button, and the "Personal Information" row each open the personal-information screen.
- "Notifications" row → notification-settings; "Privacy & Security" row → security (MFA reachable there).
- Theme row toggles light/dark/system via the existing control.
- "Help & Support" opens the device mail composer addressed to `support@rhkproperties.com`.
- "Sign Out" shows a confirm dialog; confirming logs out and lands on the login screen; cancelling does nothing.
- On a tab screen, tapping the top header avatar/name opens the profile page; the notification bell still opens notifications.

- [ ] **Step 3: Final verification gate**

Run: `npx tsc --noEmit && pnpm lint`
Expected: both exit 0.

- [ ] **Step 4: Clean up brainstorm server (optional)**

Run: `/Users/nabeel.ahmed/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/brainstorming/scripts/stop-server.sh /Users/nabeel.ahmed/Desktop/Projects/boh/boh-mobile/.superpowers/brainstorm/48232-1779102048`
Expected: server stops. Mockup files persist under `.superpowers/brainstorm/` (add `.superpowers/` to `.gitignore`).

---

## Self-Review

**Spec coverage:**

- Theme tokens / no hex → Task 1 (semantic classes throughout, `useThemeColor('--destructive')` for the danger icon). ✓
- Real data only (avatar/name/email/role; role omitted if none) → Task 1 identity block. ✓
- Layout C (centered avatar, role pill, email, Edit Profile button) → Task 1. ✓
- Identity + button → personal-information → Task 1 `goEditProfile`. ✓
- ACCOUNT + PREFERENCES groups with exact routes → Task 1. ✓
- Help & Support → mailto → Task 1 `openSupport`. ✓
- Sign Out confirm + unchanged chain → Task 1 `confirmSignOut`/`handleSignOut`. ✓
- MainHeader avatar+name → profile → Task 2. ✓
- Removals (stats grid, Business Hub, fake badges, BRAND consts, StatCard) → achieved by full-file rewrite in Task 1. ✓
- Verification via tsc + lint + manual QA → Tasks 1–3. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases". All steps contain full code or exact commands. ✓

**Type consistency:** `IconName` imported from `Icon.tsx` (verified `export type IconName` exists). Icon names `UserRound`/`Bell`/`Shield`/`Palette`/`LifeBuoy`/`LogOut`/`ChevronRight` verified against `lucide-react-native/dist/icons.d.ts`. `SettingRow`/`SettingGroup` props consistent between definition and call sites. `goEditProfile`/`handleSignOut`/`confirmSignOut`/`openSupport` names consistent. ✓
