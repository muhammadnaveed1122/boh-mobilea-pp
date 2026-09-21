import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge } from '@/components/atoms/Badge';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useAuthStore } from '@/store/auth.store';

interface SettingsRowProps {
  icon: IconName;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  isLast?: boolean;
}

function SettingsRow({
  icon,
  label,
  sublabel,
  onPress,
  danger,
  isLast,
}: Readonly<SettingsRowProps>) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-4 active:opacity-70"
      style={
        isLast ? undefined : { borderBottomWidth: 1, borderBottomColor: 'rgb(229 229 229 / 0.5)' }
      }
    >
      <Icon name={icon} size={20} color={danger ? '#EF4444' : undefined} />
      <View className="flex-1">
        <Text className="text-sm font-medium" style={danger ? { color: '#EF4444' } : undefined}>
          {label}
        </Text>
        {sublabel ? <Text className="mt-0.5 text-xs text-muted-foreground">{sublabel}</Text> : null}
      </View>
      {!danger && <Icon name="ChevronRight" size={16} />}
    </Pressable>
  );
}

export function MfaSettingsSection() {
  const router = useRouter();
  const mfaEnabled = useAuthStore((s) => s.user?.mfaEnabled ?? false);

  return (
    <View>
      <View className="mt-6 flex-row items-center justify-between px-4">
        <Text className="text-xl font-bold text-foreground">Security</Text>
        <Badge variant={mfaEnabled ? 'successSoft' : 'mutedSoft'} className="px-2.5 py-1">
          <Text>{mfaEnabled ? '2FA On' : '2FA Off'}</Text>
        </Badge>
      </View>

      <View className="mx-4 mt-3 overflow-hidden rounded-2xl bg-card">
        {mfaEnabled ? (
          <>
            <SettingsRow
              icon="KeyRound"
              label="Regenerate backup codes"
              sublabel="Invalidates existing codes and issues new ones"
              onPress={() => router.push('/(app)/mfa-regenerate-backup-codes')}
            />
            <SettingsRow
              icon="ShieldOff"
              label="Disable two-factor"
              sublabel="Turn off two-factor authentication"
              onPress={() => router.push('/(app)/mfa-disable')}
              danger
              isLast
            />
          </>
        ) : (
          <SettingsRow
            icon="ShieldCheck"
            label="Enable two-factor"
            sublabel="Add an authenticator app to protect your account"
            onPress={() => router.push('/(app)/mfa-setup')}
            isLast
          />
        )}
      </View>
    </View>
  );
}
