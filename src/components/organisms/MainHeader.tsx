import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useRole } from '@/lib/rbac';
import { getInitials } from '@/lib/user';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useCallStore } from '@/features/callService/store/call.store';
import { getSipStatusPresentation } from '@/features/callService/lib/sip-status';

export const MAIN_HEADER_HEIGHT = 64;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning,';
  if (h < 18) return 'Good Afternoon,';
  return 'Good Evening,';
}

interface Props {
  unreadCount?: number;
  onPressNotifications?: () => void;
}

export function MainHeader({ unreadCount = 0, onPressNotifications }: Readonly<Props>) {
  const { top } = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const sipStatus = getSipStatusPresentation(useCallStore((s) => s.sipConnection));
  const { isEndUserShell } = useRole();
  // End-user personas have a Profile tab — jump to it so the bar highlight
  // stays in sync. Staff tab sets have no Profile button, so jumping would
  // leave the bar with no active tab; push the stack route (/account) over the
  // tabs instead, like any other detail screen.
  const profileHref = isEndUserShell ? '/profile' : '/account';

  const fullName =
    user?.profile?.fullName?.trim() ||
    [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(' ').trim() ||
    'there';
  const photoUrl = user?.profile?.profilePicUrl ?? null;

  return (
    <View style={{ paddingTop: top }} className="bg-background">
      <View
        className="flex-row items-center justify-between px-4 pb-2 pt-2"
        style={{ height: MAIN_HEADER_HEIGHT }}
      >
        <Pressable
          onPress={() => router.push(profileHref)}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          className="flex-row items-center gap-3 active:opacity-70"
        >
          <View className="relative">
            <Avatar alt={fullName} className="h-11 w-11">
              {photoUrl ? <AvatarImage source={{ uri: photoUrl }} /> : null}
              <AvatarFallback>
                <Text>{getInitials(fullName)}</Text>
              </AvatarFallback>
            </Avatar>
            {/* Calling-service presence dot — green when registered, hidden when disconnected. */}
            {sipStatus.visible ? (
              <View
                accessibilityLabel={sipStatus.caption}
                className={cn(
                  'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background',
                  sipStatus.dotClass,
                )}
              />
            ) : null}
          </View>
          <View>
            <Text className="text-xs text-muted-foreground">{greeting()}</Text>
            <Text className="text-base font-bold text-foreground">{fullName}!</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={onPressNotifications}
          className="relative h-11 w-11 items-center justify-center rounded-xl border border-border bg-card active:opacity-70"
          accessibilityLabel="Notifications"
        >
          <Icon name="Bell" size={20} />
          {unreadCount > 0 && (
            <View className="absolute right-1.5 top-1.5 h-4 min-w-4 items-center justify-center rounded-full bg-info px-1">
              <Text className="text-[10px] font-bold text-info-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
