/**
 * The sticky control strip above the leads feed: search, filter button, status
 * pills, and the applied-filter chips.
 *
 * Status stays out here rather than in the sheet because it is the filter
 * people flip constantly — burying it behind two taps would be the wrong trade
 * for the one control worth a permanent slot.
 */

import { View } from 'react-native';

import { SearchFilterRow } from '@/components/molecules';

import type { FilterKey, LeadsFilterState } from '../../../models/leads-filters';
import { ActiveFiltersRow } from '../../filters/ActiveFiltersRow';
import { LeadsStatusPills, type StatusPillValue } from '../../LeadsStatusPills';

interface LeadsFeedToolbarProps {
  /** Hairline appears only once the feed has scrolled under the bar. */
  withBorder: boolean;
  searchValue: string;
  onSearchChange: (v: string) => void;
  onOpenFilters: () => void;
  filterCount: number;
  filters: LeadsFilterState;
  onStatusChange: (s: StatusPillValue) => void;
  onRemoveFilter: (key: FilterKey) => void;
  onClearFilters: () => void;
}

export function LeadsFeedToolbar({
  withBorder,
  searchValue,
  onSearchChange,
  onOpenFilters,
  filterCount,
  filters,
  onStatusChange,
  onRemoveFilter,
  onClearFilters,
}: Readonly<LeadsFeedToolbarProps>) {
  return (
    <View className={`bg-background pb-3 pt-1 ${withBorder ? 'border-b border-border' : ''}`}>
      <SearchFilterRow
        value={searchValue}
        onChange={onSearchChange}
        onOpenFilters={onOpenFilters}
        filterCount={filterCount}
        placeholder="Search by name, email or phone…"
      />
      <LeadsStatusPills value={filters.status ?? 'All'} onChange={onStatusChange} />
      <ActiveFiltersRow filters={filters} onRemove={onRemoveFilter} onClearAll={onClearFilters} />
    </View>
  );
}
