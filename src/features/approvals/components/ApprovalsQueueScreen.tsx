import * as React from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon } from '@/components/atoms/Icon';
import { Skeleton } from '@/components/atoms/Skeleton';
import { Text } from '@/components/atoms/Text';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { getQueueDef } from '../constants/queues';
import type { ApprovalRequestListItem } from '../models/approval';
import { useApprovalsQueue, type ApprovalTab } from '../hooks/use-approvals-queue';
import { ApprovalRequestCard } from './ApprovalRequestCard';
import { QueueFilters } from './QueueFilters';

const TABS: ApprovalTab[] = ['Pending', 'Approved', 'Changes Requested'];

/** Short display labels — full names don't fit three across on a phone. */
const TAB_LABEL: Record<ApprovalTab, string> = {
  Pending: 'Pending',
  Approved: 'Approved',
  'Changes Requested': 'Changes',
};

function QueueTabs({
  tab,
  counts,
  onChange,
}: Readonly<{
  tab: ApprovalTab;
  counts: Record<ApprovalTab, number>;
  onChange: (t: ApprovalTab) => void;
}>) {
  return (
    <View className="flex-row border-b border-border px-4">
      {TABS.map((t) => {
        const active = tab === t;
        return (
          <Pressable
            key={t}
            onPress={() => onChange(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={cn(
              '-mb-px mr-6 flex-row items-center gap-1.5 border-b-2 pb-2.5 pt-1',
              active ? 'border-brand' : 'border-transparent',
            )}
          >
            <Text
              numberOfLines={1}
              className={cn(
                'text-sm',
                active ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
              )}
            >
              {TAB_LABEL[t]}
            </Text>
            <View
              className={cn(
                'min-w-5 items-center rounded-full px-1.5 py-0.5',
                active ? 'bg-brand' : 'bg-muted',
              )}
            >
              <Text
                className={cn(
                  'text-xs font-semibold',
                  active ? 'text-brand-foreground' : 'text-muted-foreground',
                )}
              >
                {counts[t]}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScreenHeader({ title }: Readonly<{ title: string }>) {
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: top }} className="bg-background">
      <View className="flex-row items-center gap-3 px-4 pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="-ml-1 h-9 w-9 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon name="ArrowLeft" size={24} />
        </Pressable>
        <Text numberOfLines={1} className="flex-1 text-xl font-bold text-foreground">
          {title}
        </Text>
      </View>
    </View>
  );
}

function ListEmpty({ isLoading, isError }: Readonly<{ isLoading: boolean; isError: boolean }>) {
  if (isLoading) {
    return (
      <View className="gap-3 px-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-2xl" />
        ))}
      </View>
    );
  }
  if (isError) {
    return (
      <View className="items-center px-8 pt-10">
        <EmptyState
          icon="CircleAlert"
          title="Couldn't load requests"
          description="Pull down to retry."
        />
      </View>
    );
  }
  return (
    <View className="items-center px-8 pt-10">
      <EmptyState icon="Inbox" title="No requests" description="Nothing in this tab yet." />
    </View>
  );
}

export function ApprovalsQueueScreen() {
  const insets = useSafeAreaInsets();
  const { queue: queueParam } = useLocalSearchParams<{ queue: string }>();
  const def = getQueueDef(queueParam ?? '');
  const queue = def?.slug ?? 'listings-status';
  const state = useApprovalsQueue(queue);
  const canApprovals = useCan(PERMISSIONS.APPROVALS_ACT);

  if (!canApprovals) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Approvals" />
        <View className="items-center px-8 pt-16">
          <Text className="text-center text-sm text-muted-foreground">
            You don’t have access to approvals.
          </Text>
        </View>
      </View>
    );
  }

  if (def === undefined) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Approvals" />
        <View className="items-center px-8 pt-16">
          <Text className="text-sm text-muted-foreground">Queue not found.</Text>
        </View>
      </View>
    );
  }

  if (def.deferred) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title={def.label} />
        <View className="items-center px-8 pt-16">
          <EmptyState
            icon="Clock"
            title="Coming soon"
            description="This approval queue isn’t enabled yet."
          />
        </View>
      </View>
    );
  }

  const openAudit = (request: ApprovalRequestListItem) =>
    router.push({
      pathname: '/(app)/approvals/[queue]/[id]',
      params: { queue, id: request.id },
    });

  const openListing = (request: ApprovalRequestListItem) => {
    const kind =
      request.listingPreview?.kind ??
      (request.resourceType === 'listing' ? 'primary' : 'secondary');
    router.push({ pathname: '/listings/edit/[id]', params: { id: request.resourceId, kind } });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={def.label} />
      <FlatList
        data={state.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-4 pb-4">
            <ApprovalRequestCard
              request={item}
              onOpenAudit={() => openAudit(item)}
              onOpenListing={() => openListing(item)}
            />
          </View>
        )}
        ListHeaderComponent={
          <View className="gap-3 pb-1">
            <View className="px-4">
              <Text className="text-sm text-muted-foreground">{def.subtitle}</Text>
            </View>
            <QueueFilters
              filters={state.filters}
              onFilterChange={state.setFilter}
              onReset={state.reset}
            />
            <QueueTabs tab={state.tab} counts={state.counts} onChange={state.setTab} />
          </View>
        }
        ListEmptyComponent={<ListEmpty isLoading={state.isLoading} isError={state.isError} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (state.hasNextPage && !state.isFetchingNextPage) state.fetchNextPage();
        }}
        ListFooterComponent={
          state.isFetchingNextPage ? (
            <View className="py-6">
              <ActivityIndicator />
            </View>
          ) : null
        }
        refreshing={state.isRefetching}
        onRefresh={state.refetch}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}
