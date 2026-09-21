import { FlatList, View } from 'react-native';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import type { PriorityItem } from '../../types';
import { PriorityRow, PRIORITY_CARD_WIDTH } from './PriorityRow';

interface TodaysPrioritiesProps {
  items: PriorityItem[];
  loading?: boolean;
  error?: Error | null;
}

const CARD_GAP = 12; // matches separator width (w-3)
const SNAP = PRIORITY_CARD_WIDTH + CARD_GAP;

function CardSeparator() {
  return <View style={{ width: CARD_GAP }} />;
}

function renderPriority({ item }: Readonly<{ item: PriorityItem }>) {
  return <PriorityRow item={item} />;
}

/**
 * Horizontal snap carousel — keeps the priorities section to a single card's
 * height while letting users swipe through them (peek of the next card hints
 * scrollability). Main page scroll stays vertical.
 */
export function TodaysPriorities({ items, loading, error }: Readonly<TodaysPrioritiesProps>) {
  const sorted = [...items].sort((a, b) => (a.conditionRank ?? 99) - (b.conditionRank ?? 99));

  return (
    <View>
      <Text className="px-4 text-base font-bold text-foreground">Today&apos;s Priorities</Text>

      {loading ? (
        <View className="mt-3 flex-row gap-3 px-4">
          <Skeleton className="h-24 w-56 rounded-2xl" />
          <Skeleton className="h-24 w-56 rounded-2xl" />
        </View>
      ) : null}

      {!loading && error ? (
        <View className="mx-4 mt-3 rounded-xl bg-destructive/10 px-3 py-2">
          <Text className="text-xs text-destructive">{error.message}</Text>
        </View>
      ) : null}

      {!loading && !error && sorted.length === 0 ? (
        <EmptyState
          icon="ListChecks"
          title="No priorities right now"
          description="New high-priority leads will appear here."
        />
      ) : null}

      {!loading && !error && sorted.length > 0 ? (
        <FlatList
          horizontal
          className="mt-3"
          data={sorted}
          keyExtractor={(i) => i.leadId}
          renderItem={renderPriority}
          showsHorizontalScrollIndicator={false}
          ItemSeparatorComponent={CardSeparator}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          snapToInterval={SNAP}
          snapToAlignment="start"
          decelerationRate="fast"
        />
      ) : null}
    </View>
  );
}
