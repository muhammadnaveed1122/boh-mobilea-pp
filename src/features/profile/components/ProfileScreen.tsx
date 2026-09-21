import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text } from '@/components/atoms/Text';
import { Icon } from '@/components/atoms/Icon';
import { Header } from '@/components/organisms/Header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { ThemeToggle } from '@/components/atoms/ThemeToggle';
import { getDisplayName, getInitials } from '@/lib/user';
import { SettingGroup, SettingRow } from '@/components/molecules/SettingRow';
import { cn } from '@/lib/utils';
import { CONFIG } from '@/lib/config';
import { APP_LINKS } from '@/config/app-links';
import { openSupport } from '@/lib/support';
import { performSessionTeardown } from '@/features/auth/session';
import { useThemeColor } from '@theme';
import { useAuthStore } from '@/store/auth.store';
import { useCallStore } from '@/features/callService/store/call.store';
import { getSipStatusPresentation } from '@/features/callService/lib/sip-status';

async function openLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    // No handler for URL — silent no-op.
  }
}

export function ProfileScreen({
  showBackHeader = false,
}: Readonly<{
  /** True when rendered as a pushed stack screen (/account) instead of a tab. */
  showBackHeader?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const name = getDisplayName(user);
  const initials = getInitials(name);
  const email = user?.email ?? '';
  const role = user?.roles?.[0]?.name ?? '';
  const profilePicUrl = user?.profile?.profilePicUrl ?? null;

  const [signingOut, setSigningOut] = useState(false);
  const brand = useThemeColor('--brand');

  const sipConnection = useCallStore((s) => s.sipConnection);
  const sipStatus = getSipStatusPresentation(sipConnection);

  const goEditProfile = () => router.push('/(app)/personal-information');

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await performSessionTeardown();
      router.replace('/');
    } finally {
      setSigningOut(false);
    }
  }

  function confirmSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void handleSignOut() },
    ]);
  }

  return (
    <View className="flex-1 bg-background">
      {showBackHeader ? <Header title="Profile" showBack /> : null}
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{
          // Header pads the top inset itself when shown.
          paddingTop: showBackHeader ? 16 : insets.top + 16,
          paddingBottom: 120 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity card — tap to edit. Compact horizontal layout to cut header clutter. */}
        <Pressable
          onPress={goEditProfile}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          className="mx-4 flex-row items-center gap-4 rounded-2xl bg-card p-4 active:opacity-80"
        >
          <View className="relative">
            <Avatar alt={name} className="h-16 w-16">
              {profilePicUrl ? <AvatarImage source={{ uri: profilePicUrl }} /> : null}
              <AvatarFallback textClassName="text-xl">
                <Text>{initials}</Text>
              </AvatarFallback>
            </Avatar>
            {/* Calling-service presence dot — green when SIP-registered. Hidden when disconnected. */}
            {sipStatus.visible ? (
              <View
                accessibilityLabel={sipStatus.caption}
                className={cn(
                  'absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card',
                  sipStatus.dotClass,
                )}
              />
            ) : null}
          </View>

          <View className="flex-1">
            <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
              {name}
            </Text>
            {role ? (
              <View className="mt-1 self-start rounded-full bg-muted px-2.5 py-0.5">
                <Text className="text-[11px] font-semibold text-foreground">{role}</Text>
              </View>
            ) : null}
            {email ? (
              <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>

          <View className="flex-row items-center gap-1">
            <Text className="text-xs font-semibold text-brand">Edit</Text>
            <Icon name="ChevronRight" size={16} color={brand} />
          </View>
        </Pressable>

        {/* Calling service status — hidden when disconnected (no connection). */}
        {sipStatus.visible ? (
          <SettingGroup label="CALLING SERVICE">
            <SettingRow
              icon="Phone"
              label="Calling Service"
              trailing={
                <View className="flex-row items-center gap-1.5">
                  <View className={cn('h-2 w-2 rounded-full', sipStatus.dotClass)} />
                  <Text className={cn('text-sm font-semibold', sipStatus.textClass)}>
                    {sipStatus.label}
                  </Text>
                </View>
              }
            />
          </SettingGroup>
        ) : null}

        {/* Account */}
        <SettingGroup label="ACCOUNT">
          <SettingRow
            icon="UserRound"
            label="Personal Information"
            onPress={goEditProfile}
            divider
          />
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

        {/* About & Legal — destinations configurable via src/config/app-links.json */}
        <SettingGroup label="ABOUT">
          <SettingRow
            icon="Info"
            label="About Us"
            onPress={() => void openLink(APP_LINKS.aboutUs)}
            divider
          />
          <SettingRow
            icon="FileText"
            label="Terms & Conditions"
            onPress={() => void openLink(APP_LINKS.termsAndConditions)}
            divider
          />
          <SettingRow
            icon="ShieldCheck"
            label="Privacy Policy"
            onPress={() => void openLink(APP_LINKS.privacyPolicy)}
          />
        </SettingGroup>

        {/* Danger zone */}
        <SettingGroup>
          <SettingRow
            icon="Trash2"
            label="Delete Account"
            danger
            onPress={() => router.push('/(app)/delete-account')}
          />
        </SettingGroup>

        {/* Developer — dev + opt-in tester builds */}
        {CONFIG.ENABLE_NETWORK_LOGGER ? (
          <SettingGroup label="DEVELOPER">
            <SettingRow
              icon="Activity"
              label="Network Logs"
              onPress={() => router.push('/(app)/network-logs')}
            />
          </SettingGroup>
        ) : null}
      </ScrollView>

      <Modal visible={signingOut} transparent animationType="fade" statusBarTranslucent>
        <View className="flex-1 items-center justify-center bg-black/40">
          <View className="items-center gap-3 rounded-2xl bg-card px-8 py-6">
            <ActivityIndicator size="large" color={brand} />
            <Text className="text-sm font-medium text-foreground">Signing out…</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}
