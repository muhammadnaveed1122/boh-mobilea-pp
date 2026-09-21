import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';

import { compareKey, useListingCompareStore } from '../store/compare.store';
import type { UnifiedListingRow } from '../types';

function Thumb({ row, onRemove }: Readonly<{ row: UnifiedListingRow; onRemove: () => void }>) {
  return (
    <View className="relative">
      <View className="h-12 w-12 overflow-hidden rounded-lg border border-border bg-muted">
        {row.heroImageUrl ? (
          <Image source={{ uri: row.heroImageUrl }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Icon name="Building2" size={16} />
          </View>
        )}
      </View>
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityLabel={`Remove ${row.title}`}
        className="absolute -right-1.5 -top-1.5 h-5 w-5 items-center justify-center rounded-full bg-foreground"
      >
        <Icon name="X" size={12} color="#fff" strokeWidth={3} />
      </Pressable>
    </View>
  );
}

/**
 * Floating bottom bar shown while compare mode has selections. Lists selected
 * listing thumbnails (each removable), a Clear action, and a primary
 * Compare (N) CTA enabled only when at least 2 are selected.
 */
export function ListingCompareBar() {
  const { bottom } = useSafeAreaInsets();
  const compareMode = useListingCompareStore((s) => s.compareMode);
  const items = useListingCompareStore((s) => s.items);
  const remove = useListingCompareStore((s) => s.remove);
  const clear = useListingCompareStore((s) => s.clear);

  if (!compareMode || items.length === 0) return null;

  const canCompare = items.length >= 2;

  return (
    <View
      className="absolute inset-x-0 bottom-0 border-t border-border bg-card px-4 pt-3"
      style={{ paddingBottom: bottom + 12 }}
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          {items.map((row) => (
            <Thumb key={compareKey(row)} row={row} onRemove={() => remove(compareKey(row))} />
          ))}
        </View>
        <View className="items-end gap-1.5">
          <Pressable onPress={clear} hitSlop={6} accessibilityLabel="Clear selection">
            <Text className="text-xs font-medium text-muted-foreground">Clear</Text>
          </Pressable>
          <Pressable
            disabled={!canCompare}
            onPress={() => router.push('/listings/compare')}
            accessibilityRole="button"
            accessibilityLabel={`Compare ${items.length} listings`}
            className={cn(
              'h-10 items-center justify-center rounded-full px-5',
              canCompare ? 'bg-brand active:opacity-80' : 'bg-muted',
            )}
          >
            <Text
              className={cn(
                'text-sm font-semibold',
                canCompare ? 'text-brand-foreground' : 'text-muted-foreground',
              )}
            >
              Compare ({items.length})
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
