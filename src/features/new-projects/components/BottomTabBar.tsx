import { View, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import { Icon } from '@/components/atoms/Icon';
import { Dot } from '@/components/atoms/Dot';
import { useApprovalsPendingCount } from '@/features/approvals/hooks/use-approvals-pending-count';
import { useUnreadCounts } from '@/features/chat/hooks/use-unread-counts';
import { CHAT_READ, PERMISSIONS, useCan, useRole } from '@/lib/rbac';
import { useAuthStore } from '@/store/auth.store';
import { useAuthPromptStore } from '@/store/auth-prompt.store';
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
  badgeCount = 0,
}: Readonly<{
  tab: TabItem;
  active: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
  showDot?: boolean;
  /**
   * Unread-conversation bubble. `0` hides it; anything over 99 renders as "99+".
   * Offsets mirror `Dot`'s — pushing the badge further out risks Android
   * clipping it against the icon wrapper's bounds.
   */
  badgeCount?: number;
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
      accessibilityLabel={badgeCount > 0 ? `${tab.label}, ${badgeCount} unread` : tab.label}
    >
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, animatedStyle]}>
        <View>
          <Icon name={tab.icon} size={ICON_SIZE} color={color} strokeWidth={active ? 2.6 : 2} />
          {showDot ? <Dot className="absolute -right-1.5 -top-0.5" /> : null}
          {badgeCount > 0 ? (
            <View className="absolute -right-1.5 -top-1 h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1">
              <Text className="text-[10px] font-bold leading-4 text-white">
                {badgeCount > 99 ? '99+' : badgeCount}
              </Text>
            </View>
          ) : null}
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
  const { isEndUserShell } = useRole();
  const openAuthPrompt = useAuthPromptStore((s) => s.open);

  const { count: approvalsPending } = useApprovalsPendingCount();
  const unreadChats = useUnreadCounts().all;

  const canListings = useCan([PERMISSIONS.LISTINGS_READ, PERMISSIONS.OPPORTUNITY_LISTING_READ]);
  const canLeads = useCan([PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_READ_ALL]);
  const canChat = useCan(CHAT_READ);
  const canCalls = useCan(PERMISSIONS.CALLS_READ);
  // More opens a screen whose workspace rows are these; hide it when none apply.
  const canMore = useCan([
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.AREAS_READ,
    PERMISSIONS.APPROVALS_ACT,
  ]);

  let TABS: TabItem[];
  if (!isAuthenticated) {
    TABS = PUBLIC_TABS;
  } else if (isEndUserShell) {
    // userType first: portal accounts (`client` and its promoted superset
    // `owner`) plus tenants are the end-user personas → favourites/home/profile
    // only. The `customer` role is kept as a fallback. Any other userType falls
    // through to role/permission gating. Matching `client` alone stranded
    // promoted accounts on the staff tab set with no permissions — one Home tab
    // and an empty screen.
    TABS = CUSTOMER_TABS;
  } else {
    const tabPermission: Record<string, boolean> = {
      listings: canListings,
      leads: canLeads,
      home: true,
      calls: canCalls,
      chat: canChat,
      more: canMore,
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
            badgeCount={tab.key === 'chat' ? unreadChats : 0}
            onPress={() => {
              if (!isAuthenticated && tab.requiresAuth) {
                openAuthPrompt();
                return;
              }
              if (tab.key === 'more') {
                router.push('/(app)/more');
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
