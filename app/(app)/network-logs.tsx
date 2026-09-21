import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import NetworkLogger from 'react-native-network-logger';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { useTheme } from '@theme';

// Dev-only HTTP inspector screen (Chucker-style). Logging is started in
// src/lib/api.ts behind CONFIG.ENABLE_NETWORK_LOGGER; this screen renders the
// captured calls. The (app) Stack has headerShown:false, so this screen owns its
// own top bar + SafeAreaView for status-bar / nav-bar insets.
export default function NetworkLogsScreen() {
  const { colorScheme } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()} className="active:opacity-70" hitSlop={8}>
          <Icon name="ChevronLeft" size={24} />
        </Pressable>
        <Text variant="subheading">Network Logs</Text>
      </View>
      <NetworkLogger theme={colorScheme === 'dark' ? 'dark' : 'light'} />
    </SafeAreaView>
  );
}
