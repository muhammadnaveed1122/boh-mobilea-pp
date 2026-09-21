import { useMemo, useReducer, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useThemeColor } from '@theme';
import { Icon } from '@/components/atoms/Icon';
import { Input } from '@/components/atoms/Input';
import { Text } from '@/components/atoms/Text';
import { EmptyState } from '@/components/atoms/EmptyState';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { useDebouncedValue } from '@/features/leads/hooks/use-debounced-value';
import { useBrowseLeads } from '@/features/leads/hooks/use-browse-leads';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import type { BrowseConfig, LeadListItem } from '@/features/leads/types';
import { LeadCard } from '../LeadCard';
import { StageChips } from './StageChips';
import { MarketTabs } from './MarketTabs';
import { LeadActionSheet } from './LeadActionSheet';
import { MoveStageSheet } from './MoveStageSheet';
import { AssignAgentSheet } from './AssignAgentSheet';
import { BrowseFilterSheet } from './BrowseFilterSheet';
import { PortalChannelTabs } from './portal/PortalChannelTabs';
import { browseInitialState, browseReducer, activeFilterCount } from './browseQuery';

type BrowseQuery = ReturnType<typeof useBrowseLeads>;

/** List area: handles deferred-portal / loading / error / empty / list states. */
function BrowseListBody({
  q,
  leads,
  deferredPortal,
  tabBarSpace,
  onKebab,
}: Readonly<{
  q: BrowseQuery;
  leads: LeadListItem[];
  deferredPortal: boolean;
  tabBarSpace: number;
  onKebab: (lead: LeadListItem) => void;
}>) {
  if (deferredPortal) {
    return (
      <EmptyState
        icon="PlugZap"
        title="Not connected yet"
        description="This portal integration isn't available yet."
      />
    );
  }
  if (q.isLoading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator />
      </View>
    );
  }
  if (q.isError) {
    return (
      <View className="mx-4 rounded-xl bg-destructive/10 px-3 py-2">
        <Text className="text-xs text-destructive">
          {q.error?.message ?? 'Failed to load leads.'}
        </Text>
      </View>
    );
  }
  if (leads.length === 0) {
    return <EmptyState icon="Inbox" title="No leads" description="No leads match this view." />;
  }
  return (
    <FlatList
      data={leads}
      keyExtractor={(l) => l.id}
      renderItem={({ item }) => <LeadCard lead={item} onKebab={onKebab} />}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBarSpace + 80, gap: 12 }}
      showsVerticalScrollIndicator={false}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
      }}
      ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator className="py-4" /> : null}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    />
  );
}

export function LeadsBrowseScreen({ config }: Readonly<{ config: BrowseConfig }>) {
  const insets = useSafeAreaInsets();
  const tabBarSpace = useBottomTabBarSpace();
  const mutedFg = useThemeColor('--muted-foreground');
  const brandFg = useThemeColor('--brand-foreground');
  const canCreate = useCan(PERMISSIONS.LEADS_CREATE);

  const [state, dispatch] = useReducer(browseReducer, browseInitialState);
  const debouncedSearch = useDebouncedValue(state.search, 300);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionLead, setActionLead] = useState<LeadListItem | null>(null);
  // Whole lead, not just the id — the stage sheet needs the current stage to
  // preselect it and to refuse a no-op "change".
  const [moveLead, setMoveLead] = useState<LeadListItem | null>(null);
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);

  const isPortal = config.mode === 'portal';
  const deferredPortal =
    isPortal && (state.portalSource === 'bayut' || state.portalSource === 'dubizzle');

  const q = useBrowseLeads(config, state, debouncedSearch);
  const leads = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const filterCount = activeFilterCount(state);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Icon name="ChevronLeft" size={22} />
          </Pressable>
          <Text className="text-xl font-extrabold text-foreground">{config.title}</Text>
        </View>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          className="flex-row items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2"
        >
          <Icon name="SlidersHorizontal" size={15} />
          <Text className="text-xs font-bold text-foreground">
            Filters{filterCount ? ` (${filterCount})` : ''}
          </Text>
        </Pressable>
      </View>

      {/* Mode-specific top region. `newProject` has neither strip — it is a lead kind, so
          splitting it by market or channel would filter a filter. */}
      {config.mode === 'intent' ? (
        <MarketTabs
          value={state.marketTab}
          onChange={(v) => dispatch({ type: 'marketTab', value: v })}
        />
      ) : null}
      {isPortal ? (
        <PortalChannelTabs
          value={state.channelTab}
          portalSource={state.portalSource}
          onChange={(v) => dispatch({ type: 'channelTab', value: v })}
        />
      ) : null}

      {/* Search */}
      <View className="mx-4 mb-2 mt-2 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3">
        <Icon name="Search" size={18} color={mutedFg} />
        <Input
          value={state.search}
          onChangeText={(v) => dispatch({ type: 'search', value: v })}
          placeholder="Search name, phone, email"
          className="flex-1 border-0 bg-transparent px-0"
        />
      </View>

      <View className="mb-2">
        <StageChips value={state.stage} onChange={(v) => dispatch({ type: 'stage', value: v })} />
      </View>

      {/* List */}
      <BrowseListBody
        q={q}
        leads={leads}
        deferredPortal={deferredPortal}
        tabBarSpace={tabBarSpace}
        onKebab={setActionLead}
      />

      {/* Create FAB */}
      {canCreate ? (
        <Pressable
          onPress={() => router.push('/leads/create')}
          accessibilityRole="button"
          accessibilityLabel="Create lead"
          style={{
            position: 'absolute',
            right: 16,
            bottom: tabBarSpace,
            elevation: 6,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
          className="h-14 w-14 items-center justify-center rounded-full bg-brand"
        >
          <Icon name="Plus" size={24} color={brandFg} />
        </Pressable>
      ) : null}

      {/* Sheets */}
      <BrowseFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        priority={state.priority}
        assignment={state.assignment}
        assigneeId={state.assigneeId}
        onPriority={(p) => dispatch({ type: 'priority', value: p })}
        onAssignment={(a) => dispatch({ type: 'assignment', value: a })}
        onAssigneeId={(id) => dispatch({ type: 'assigneeId', value: id })}
        onClear={() => dispatch({ type: 'clearFilters' })}
        portalSource={isPortal ? state.portalSource : undefined}
        onPortalSource={isPortal ? (s) => dispatch({ type: 'portalSource', value: s }) : undefined}
      />
      <LeadActionSheet
        lead={actionLead}
        visible={!!actionLead}
        onClose={() => setActionLead(null)}
        onMoveStage={(l) => {
          setActionLead(null);
          setMoveLead(l);
        }}
        onAssign={(l) => {
          setActionLead(null);
          setAssignLeadId(l.id);
        }}
      />
      <MoveStageSheet
        leadId={moveLead?.id ?? null}
        currentStatus={moveLead?.status ?? null}
        visible={!!moveLead}
        onClose={() => setMoveLead(null)}
      />
      <AssignAgentSheet
        leadId={assignLeadId}
        visible={!!assignLeadId}
        onClose={() => setAssignLeadId(null)}
      />
    </View>
  );
}
