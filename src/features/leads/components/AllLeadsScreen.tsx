import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon } from '@/components/atoms/Icon';
import { MAIN_HEADER_HEIGHT } from '@/components/organisms';
import { useBottomTabBarSpace } from '@/features/new-projects/components/BottomTabBar';
import { PERMISSIONS, useCan } from '@/lib/rbac';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useThemeColor } from '@theme';
import type { AllLeadsParams } from '../hooks/use-all-leads';
import type { LeadStatus } from '../types';
import { AllLeadsHeader } from './AllLeadsHeader';
import { AllLeadsList } from './AllLeadsList';
import { LeadsFiltersSheet, type LeadsFilterDraft } from './LeadsFiltersSheet';
import type { StatusPillValue } from './LeadsStatusPills';

function countActiveFilters(f: LeadsFilterDraft): number {
  let n = 0;
  if (f.interest) n += 1;
  if (f.interestType) n += 1;
  if (f.priority) n += 1;
  return n;
}

function CreateLeadFab({ onPress }: Readonly<{ onPress: () => void }>) {
  const tabBarSpace = useBottomTabBarSpace();
  const brandFg = useThemeColor('--brand-foreground');
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Create lead"
      style={{
        position: 'absolute',
        right: 16,
        bottom: tabBarSpace,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
      className="h-14 w-14 items-center justify-center rounded-full bg-brand active:opacity-80"
    >
      <Icon name="Plus" size={24} color={brandFg} />
    </Pressable>
  );
}

interface AllLeadsScreenProps {
  /**
   * Reserve top space for the GlobalMainHeader overlay. True on the `/leads`
   * tab route (the global header renders there). False when pushed (e.g.
   * `/leads/all` from the dashboard "View all"), where no global header renders
   * and AllLeadsHeader's own back button is the nav — otherwise the reserved
   * space shows as an empty gap.
   */
  reserveMainHeaderSpace?: boolean;
  /**
   * Status pill to pre-select on mount (e.g. opening `/leads/all?status=New`
   * from the dashboard "New Leads" tile). Defaults to 'All'.
   */
  initialStatus?: StatusPillValue;
  /**
   * Inclusive ISO (`YYYY-MM-DD`) date window from the route, e.g.
   * `/leads/all?dateFrom=2026-07-13&dateTo=2026-07-13` from the dashboard's
   * "Today's Leads" tile. Fixed for the life of the screen — there's no UI
   * to change it once opened.
   */
  dateFrom?: string;
  dateTo?: string;
}

export function AllLeadsScreen({
  reserveMainHeaderSpace = true,
  initialStatus = 'All',
  dateFrom,
  dateTo,
}: Readonly<AllLeadsScreenProps>) {
  const insets = useSafeAreaInsets();
  const canCreate = useCan(PERMISSIONS.LEADS_CREATE);

  const [status, setStatus] = useState<StatusPillValue>(initialStatus);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<LeadsFilterDraft>({});
  const [sheetVisible, setSheetVisible] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const filterCount = countActiveFilters(filters);

  const params = useMemo<AllLeadsParams>(
    () => ({
      status: status === 'All' ? undefined : (status as LeadStatus),
      search: debouncedSearch.length > 0 ? debouncedSearch : undefined,
      interest: filters.interest,
      interestType: filters.interestType,
      priority: filters.priority,
      dateFrom,
      dateTo,
    }),
    [status, debouncedSearch, filters, dateFrom, dateTo],
  );

  const goCreate = () => router.push('/leads/create');

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top + (reserveMainHeaderSpace ? MAIN_HEADER_HEIGHT : 0) }}
    >
      <AllLeadsHeader canCreate={canCreate} onCreatePress={goCreate} />
      <AllLeadsList
        params={params}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onOpenFilters={() => setSheetVisible(true)}
        filterCount={filterCount}
        status={status}
        onStatusChange={setStatus}
      />
      {canCreate ? <CreateLeadFab onPress={goCreate} /> : null}
      <LeadsFiltersSheet
        visible={sheetVisible}
        initial={filters}
        onClose={() => setSheetVisible(false)}
        onApply={setFilters}
      />
    </View>
  );
}
