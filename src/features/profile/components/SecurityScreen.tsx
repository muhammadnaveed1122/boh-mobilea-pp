import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '@/components/organisms/Header';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { BiometricSettingsSection } from './BiometricSettingsSection';
import { MfaSettingsSection } from './MfaSettingsSection';

interface SettingsRowProps {
  icon: IconName;
  label: string;
  sublabel?: string;
  onPress: () => void;
  isLast?: boolean;
}

function SettingsRow({ icon, label, sublabel, onPress, isLast }: Readonly<SettingsRowProps>) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-4 active:opacity-70"
      style={
        isLast ? undefined : { borderBottomWidth: 1, borderBottomColor: 'rgb(229 229 229 / 0.5)' }
      }
    >
      <Icon name={icon} size={20} />
      <View className="flex-1">
        <Text className="text-sm font-medium">{label}</Text>
        {sublabel ? <Text className="mt-0.5 text-xs text-muted-foreground">{sublabel}</Text> : null}
      </View>
      <Icon name="ChevronRight" size={16} />
    </Pressable>
  );
}

export function SecurityScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <Header title="Privacy & Security" showBack />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="px-4 text-xl font-bold text-foreground">Account</Text>
        <View className="mx-4 mt-3 overflow-hidden rounded-2xl bg-card">
          <SettingsRow
            icon="KeyRound"
            label="Change Password"
            sublabel="Update your account password"
            onPress={() => router.push('/(app)/change-password')}
            isLast
          />
        </View>

        <MfaSettingsSection />

        <BiometricSettingsSection />
      </ScrollView>
    </View>
  );
}
