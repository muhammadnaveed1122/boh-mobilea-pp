import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { SettingGroup, SettingRow } from '@/components/molecules/SettingRow';
import { Header } from '@/components/organisms/Header';
import { useApprovalsPendingCount } from '@/features/approvals/hooks/use-approvals-pending-count';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { getDisplayName, getInitials } from '@/lib/user';
import { useAuthStore } from '@/store/auth.store';
import { useThemeColor } from '@theme';

interface MoreRow {
  readonly key: string;
  readonly label: string;
  readonly icon: IconName;
  readonly href: string;
  readonly visible: boolean;
  /** Pending-item count, shown as a destructive badge after the label. */
  readonly count?: number;
}

/**
 * Identity card. Doubles as the entry point to the full profile screen, which
 * already owns account settings, preferences, legal and sign-out — so More
 * links there rather than restating those rows and having two places to edit.
 */
function ProfileCard() {
  const user = useAuthStore((s) => s.user);
  const brand = useThemeColor('--brand');

  const name = getDisplayName(user);
  const email = user?.email ?? '';
  const role = user?.roles?.[0]?.name ?? '';
  const profilePicUrl = user?.profile?.profilePicUrl ?? null;

  return (
    <Pressable
      onPress={() => router.push('/(app)/account')}
      accessibilityRole="button"
      accessibilityLabel={`Open profile for ${name}`}
      className="mx-4 mt-4 flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3.5 active:opacity-70"
    >
      <Avatar alt={name} className="h-14 w-14">
        {profilePicUrl ? <AvatarImage source={{ uri: profilePicUrl }} /> : null}
        <AvatarFallback>
          <Text className="text-base font-semibold">{getInitials(name)}</Text>
        </AvatarFallback>
      </Avatar>

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
        <Text className="text-xs font-semibold text-brand">View</Text>
        <Icon name="ChevronRight" size={16} color={brand} />
      </View>
    </Pressable>
  );
}

/**
 * "More" screen — replaces the old bottom sheet. A pushed screen rather than a
 * sheet so rows can grow past a sheet's comfortable height, and so each
 * destination keeps a normal back stack.
 */
export function MoreScreen() {
  const insets = useSafeAreaInsets();

  const canAreas = useCan(PERMISSIONS.AREAS_READ);
  const canProjects = useCan(PERMISSIONS.PROJECTS_READ);
  const canApprovals = useCan(PERMISSIONS.APPROVALS_ACT);
  const { count: approvalsPending } = useApprovalsPendingCount();

  const rows: MoreRow[] = [
    {
      key: 'projects',
      label: 'Project List',
      icon: 'Building2',
      href: '/(app)/project-management',
      visible: canProjects,
    },
    { key: 'areas', label: 'Areas', icon: 'MapPin', href: '/(app)/areas', visible: canAreas },
    {
      key: 'approvals',
      label: 'Approvals',
      icon: 'BadgeCheck',
      href: '/(app)/approvals',
      visible: canApprovals,
      count: approvalsPending,
    },
  ];

  const visibleRows = rows.filter((row) => row.visible);
  const version = Constants.expoConfig?.version ?? '';

  return (
    <View className="flex-1 bg-background">
      {/* Pushed over the tabs, so it owns a back affordance. */}
      <Header title="More" showBack />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileCard />

        {visibleRows.length > 0 ? (
          <SettingGroup label="WORKSPACE">
            {visibleRows.map((row, i) => {
              const pending = row.count ?? 0;
              return (
                <SettingRow
                  key={row.key}
                  icon={row.icon}
                  label={row.label}
                  divider={i < visibleRows.length - 1}
                  onPress={() => router.push(row.href as Parameters<typeof router.push>[0])}
                  trailing={
                    pending > 0 ? (
                      <View className="flex-row items-center gap-2">
                        <Badge variant="destructive">
                          <Text>{pending > 9 ? '9+' : pending}</Text>
                        </Badge>
                        <Icon name="ChevronRight" size={18} />
                      </View>
                    ) : undefined
                  }
                />
              );
            })}
          </SettingGroup>
        ) : null}

        {version ? (
          <Text className="mt-6 text-center text-[11px] text-muted-foreground">
            Version {version}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
