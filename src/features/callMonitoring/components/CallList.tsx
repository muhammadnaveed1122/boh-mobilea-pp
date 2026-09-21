import { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Text } from '@/components/atoms/Text';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useThemeColor } from '@theme';
import type { CallRecord } from '../models/call-record';
import type { RecordingPlayer } from '../hooks/use-recording-player';
import { CallRecordCard } from './CallRecordCard';

interface Props {
  records: CallRecord[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  dncMap: Record<string, boolean> | undefined;
  player: RecordingPlayer;
  ListHeaderComponent: React.ReactElement;
  onEndReached: () => void;
  onRefresh: () => void;
  onSelect: (record: CallRecord) => void;
  /** Extra bottom padding, e.g. to clear a floating button over the list. */
  extraBottomSpace?: number;
}

export function CallList({
  records,
  total,
  isLoading,
  isError,
  isRefetching,
  isFetchingNextPage,
  dncMap,
  player,
  ListHeaderComponent,
  onEndReached,
  onRefresh,
  onSelect,
  extraBottomSpace = 0,
}: Readonly<Props>) {
  const tabBarSpace = useBottomTabBarSpace();
  const brand = useThemeColor('--brand');

  const footer = isFetchingNextPage ? (
    <View className="py-6">
      <ActivityIndicator color={brand} />
    </View>
  ) : null;

  const empty = useMemo(() => {
    if (isLoading) {
      return (
        <View className="items-center py-16">
          <ActivityIndicator color={brand} />
        </View>
      );
    }
    if (isError) {
      return (
        <EmptyState icon="TriangleAlert" title="Couldn't load calls" description="Pull to retry." />
      );
    }
    return (
      <EmptyState icon="Phone" title="No calls" description="No calls for the selected filters." />
    );
  }, [isLoading, isError, brand]);

  const isDncFor = (r: CallRecord): boolean => {
    if (r.callerIdNumber === null) return false;
    return dncMap?.[r.callerIdNumber] ?? r.isDnc ?? false;
  };

  return (
    <FlatList
      data={records}
      keyExtractor={(r) => r.id || r.uuid}
      renderItem={({ item }) => (
        <View className="px-4 pb-3">
          <CallRecordCard
            record={item}
            isDnc={isDncFor(item)}
            player={player}
            onPress={() => onSelect(item)}
          />
        </View>
      )}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={empty}
      ListFooterComponent={
        records.length > 0 ? (
          <View className="px-4 pb-2">
            <Text className="text-center text-xs text-muted-foreground">
              {records.length} of {total} call{total === 1 ? '' : 's'}
            </Text>
            {footer}
          </View>
        ) : (
          footer
        )
      }
      contentContainerStyle={{ paddingBottom: tabBarSpace + 24 + extraBottomSpace }}
      showsVerticalScrollIndicator={false}
      onEndReachedThreshold={0.5}
      onEndReached={onEndReached}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={onRefresh}
          tintColor={brand}
        />
      }
    />
  );
}
