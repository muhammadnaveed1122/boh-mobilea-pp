import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useThemeColor } from '@theme';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import type { PriorityItem } from '../../types';
import { actionCta, TONE_BAR, TONE_TOKEN } from './action-cta';

/** Fixed card width (px) — kept in sync with the snap interval in TodaysPriorities. */
export const PRIORITY_CARD_WIDTH = 224; // w-56

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function formatPrice(price?: number | null): string | null {
  if (price == null) return null;
  return `AED ${price.toLocaleString('en-US')}`;
}

/**
 * Compact priority card for the horizontal carousel. Tone-keyed left accent
 * bar + an action icon in the CTA chip make urgency scannable at a glance; the
 * top-ranked lead gets a flame marker.
 */
export function PriorityRow({ item }: Readonly<{ item: PriorityItem }>) {
  const cta = actionCta(item.actionType);
  const price = formatPrice(item.property?.price);
  const accent = useThemeColor(TONE_TOKEN[cta.tone]);
  const flame = useThemeColor('--destructive');
  const isTop = item.conditionRank === 1;

  return (
    <Pressable
      onPress={() => router.push(`/leads/${item.leadId}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name ?? 'Lead'}, ${cta.label}`}
      style={({ pressed }) => (pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : null)}
      className="w-56 overflow-hidden rounded-2xl border border-border bg-card"
    >
      <View className={`absolute bottom-0 left-0 top-0 w-1.5 ${TONE_BAR[cta.tone]}`} />

      <View className="py-3 pl-4 pr-3">
        <View className="flex-row items-center gap-2">
          <Avatar alt={item.name ?? 'Lead'} className="h-8 w-8">
            {item.avatarUrl ? <AvatarImage source={{ uri: item.avatarUrl }} /> : null}
            <AvatarFallback>
              <Text className="text-[11px]">{initials(item.name)}</Text>
            </AvatarFallback>
          </Avatar>
          <Text className="flex-1 text-sm font-bold text-foreground" numberOfLines={1}>
            {item.name ?? 'Unknown lead'}
          </Text>
          {isTop ? <Icon name="Flame" size={15} color={flame} fill={flame} /> : null}
        </View>

        <Text className="mt-1.5 text-xs text-muted-foreground" numberOfLines={1}>
          {item.reason}
        </Text>

        <View className="mt-2 flex-row items-center justify-between gap-2">
          <Badge variant={cta.tone} className="gap-1">
            <Icon name={cta.icon} size={12} color={accent} />
            <Text>{cta.label}</Text>
          </Badge>
          {price ? (
            <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
              {price}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
