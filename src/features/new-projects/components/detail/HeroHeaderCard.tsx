import { View } from 'react-native';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import type { IconName } from '@/components/atoms/Icon';
import { useThemeColor } from '@theme';
import type { ProjectHighlights } from '../../types';
import { formatAed, parsePrice, propertyTypeLabel } from '../../utils/format';

interface Props {
  title: string;
  location?: string | null;
  highlights: ProjectHighlights | undefined;
}

interface Chip {
  icon: IconName;
  label: string;
}

export function HeroHeaderCard({ title, location, highlights }: Readonly<Props>) {
  const mutedFg = useThemeColor('--muted-foreground');

  const price = highlights
    ? parsePrice({
        startingPrice: highlights.startingPrice,
        publicStartingPrice: highlights.publicStartingPrice,
      })
    : 0;

  const chips: Chip[] = [];
  const stage = propertyTypeLabel(highlights?.availability);
  if (stage) chips.push({ icon: 'CircleCheck', label: stage });
  const use = propertyTypeLabel(highlights?.propertyUse);
  if (use) chips.push({ icon: 'House', label: use });
  if (highlights?.handoverDate) chips.push({ icon: 'Calendar', label: highlights.handoverDate });
  const dev = highlights?.developer?.brandName;
  if (dev) chips.push({ icon: 'Building', label: dev });

  return (
    <View className="mx-4 -mt-6 rounded-3xl bg-card p-5 shadow-sm">
      {title ? (
        <Text className="text-2xl font-bold text-foreground" numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      {location ? (
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <Icon name="MapPin" size={13} color={mutedFg} />
          <Text className="flex-1 text-sm text-muted-foreground" numberOfLines={1}>
            {location}
          </Text>
        </View>
      ) : null}

      <View className="mt-4 flex-row items-end justify-between">
        <View className="flex-1">
          <Text className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Starting from
          </Text>
          <Text className="text-2xl font-bold text-brand">{formatAed(price)}</Text>
        </View>
      </View>

      {chips.length > 0 ? (
        <View className="mt-4 flex-row flex-wrap gap-2">
          {chips.map((c) => (
            <View
              key={c.label}
              className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"
            >
              <Icon name={c.icon} size={13} color={mutedFg} />
              <Text className="text-xs font-medium text-foreground">{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
