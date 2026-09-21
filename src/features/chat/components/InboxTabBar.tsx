import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import type { InboxTab } from '../hooks/use-chat-inbox';
import { useUnreadCounts } from '../hooks/use-unread-counts';
import type { Channel } from '../models/channel';
import { ChannelIcon } from './ChannelIcon';

interface TabConfig {
  id: InboxTab;
  label: string;
  channel?: Channel;
  accentToken?: '--success' | '--info';
}

const TABS: TabConfig[] = [
  { id: 'all', label: 'All' },
  { id: 'whatsapp', label: 'WhatsApp', channel: 'whatsapp', accentToken: '--success' },
  { id: 'messenger', label: 'Messenger', channel: 'messenger', accentToken: '--info' },
];

function Tab({
  config,
  isActive,
  unread,
  onPress,
}: Readonly<{
  config: TabConfig;
  isActive: boolean;
  /** Conversations with unread messages in this tab. `0` hides the badge. */
  unread: number;
  onPress: () => void;
}>) {
  const activeIconColor = useThemeColor('--primary-foreground');
  const accentColor = useThemeColor(config.accentToken ?? '--muted-foreground');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={
        unread > 0 ? `${config.label}, ${unread} unread conversations` : config.label
      }
      className={cn(
        'mr-2 flex-row items-center rounded-full border px-4 py-1.5 active:opacity-80',
        isActive ? 'border-transparent bg-primary' : 'border-border bg-card',
      )}
    >
      {config.channel ? (
        <ChannelIcon
          channel={config.channel}
          size={14}
          color={isActive ? activeIconColor : accentColor}
        />
      ) : null}
      <Text
        className={cn(
          'text-sm font-medium',
          config.channel ? 'ml-1.5' : '',
          isActive ? 'text-primary-foreground' : 'text-foreground',
        )}
      >
        {config.label}
      </Text>
      {unread > 0 ? (
        <View
          className={cn(
            'ml-1.5 h-5 min-w-5 items-center justify-center rounded-full px-1.5',
            isActive ? 'bg-primary-foreground' : 'bg-primary',
          )}
        >
          <Text
            className={cn(
              'text-[11px] font-bold',
              isActive ? 'text-primary' : 'text-primary-foreground',
            )}
          >
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function InboxTabBar({
  active,
  onChange,
}: Readonly<{ active: InboxTab; onChange: (tab: InboxTab) => void }>) {
  const unread = useUnreadCounts();

  return (
    <View className="border-b border-border bg-background">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        {TABS.map((config) => (
          <Tab
            key={config.id}
            config={config}
            isActive={active === config.id}
            unread={unread[config.id]}
            onPress={() => onChange(config.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
