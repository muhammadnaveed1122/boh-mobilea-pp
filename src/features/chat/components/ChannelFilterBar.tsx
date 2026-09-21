import { Pressable, ScrollView, View } from 'react-native';

import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useTheme, useThemeColor } from '@theme';

import { CHANNEL_FILTERS, CHANNEL_META, type ChannelFilter } from '../models/channel';
import type { ChannelCounts } from '../hooks/use-conversation';
import {
  COMPOSER_BG_DARK,
  COMPOSER_BG_LIGHT,
  HAIRLINE_DARK,
  HAIRLINE_LIGHT,
} from './composer-colors';

interface Props {
  active: ChannelFilter;
  counts: ChannelCounts;
  onChange: (filter: ChannelFilter) => void;
  /** Which pills to render. Defaults to every channel; callers pass a
   *  permission-filtered subset so unpermitted channels are hidden entirely. */
  filters?: readonly ChannelFilter[];
}

const FILTER_LABEL: Record<ChannelFilter, string> = {
  all: 'All',
  whatsapp: 'WhatsApp',
  email: 'Email',
  messenger: 'Messenger',
};

function FilterPill({
  filter,
  isActive,
  count,
  onPress,
}: Readonly<{ filter: ChannelFilter; isActive: boolean; count: number; onPress: () => void }>) {
  const activeIconColor = useThemeColor('--primary-foreground');
  const meta = filter === 'all' ? null : CHANNEL_META[filter];
  const channelColor = useThemeColor(meta?.accentToken ?? '--muted-foreground');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      className={cn(
        'mr-2 flex-row items-center rounded-full border px-3 py-1.5 active:opacity-80',
        isActive ? 'border-transparent bg-primary' : 'border-border bg-card',
      )}
    >
      {meta ? (
        <Icon name={meta.icon} size={14} color={isActive ? activeIconColor : channelColor} />
      ) : null}
      <Text
        className={cn(
          'text-sm font-medium',
          meta ? 'ml-1.5' : '',
          isActive ? 'text-primary-foreground' : 'text-foreground',
        )}
      >
        {FILTER_LABEL[filter]}
      </Text>
      {/* secondary contrasts on both the filled (active) and card (idle) pill, light + dark */}
      <Badge variant="secondary" className="ml-2 h-5 min-w-5 justify-center px-1.5">
        <Text>{count}</Text>
      </Badge>
    </Pressable>
  );
}

export function ChannelFilterBar({
  active,
  counts,
  onChange,
  filters = CHANNEL_FILTERS,
}: Readonly<Props>) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={{
        backgroundColor: isDark ? COMPOSER_BG_DARK : COMPOSER_BG_LIGHT,
        borderBottomWidth: 1,
        borderBottomColor: isDark ? HAIRLINE_DARK : HAIRLINE_LIGHT,
      }}
    >
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
        {filters.map((filter) => (
          <FilterPill
            key={filter}
            filter={filter}
            isActive={active === filter}
            count={counts[filter]}
            onPress={() => onChange(filter)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
