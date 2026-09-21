import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';

import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import type { Area } from '../models/area';

function CountChip({
  label,
  value,
  className,
}: Readonly<{
  label: string;
  value: number;
  className?: string;
}>) {
  return (
    <View className={cn('flex-1 items-center rounded-lg bg-muted px-1 py-1.5', className)}>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
      <Text className="text-[11px] text-muted-foreground">{label}</Text>
    </View>
  );
}

/**
 * Areas grid cell: image (16:9), name, and New/Sell/Rent count chips. Mirrors
 * web's NeighbourhoodCard. Tapping opens the area detail screen (New/Sell/Rent
 * listings), passing name + city through so the header renders without a refetch.
 */
export function AreaCard({ area }: Readonly<{ area: Area }>) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/areas/[id]',
          params: { id: area.id, name: area.name, city: area.state.name },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`Open ${area.name}`}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
      className="overflow-hidden rounded-2xl bg-card"
    >
      <View className="aspect-[16/9] w-full bg-muted">
        {area.image ? (
          <Image source={{ uri: area.image }} className="h-full w-full" resizeMode="cover" />
        ) : null}
      </View>
      <View className="gap-2 p-3">
        <Text numberOfLines={1} className="text-base font-semibold text-foreground">
          {area.name}
        </Text>
        <View className="flex-row gap-1.5">
          <CountChip label="New" value={area.counts.new} />
          <CountChip label="Sell" value={area.counts.sell} />
          <CountChip label="Rent" value={area.counts.rent} />
        </View>
      </View>
    </Pressable>
  );
}
