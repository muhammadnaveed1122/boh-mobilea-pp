import { useMemo, useRef } from 'react';
import { useListingsInfinite } from './use-listings';
import { usePrimaryListingsInfinite } from './use-primary-listings';
import { normalizePrimaryRow, normalizeSecondaryRow } from '../lib/normalize-row';
import { PRICE_OPTIONS } from '../lib/filters';
import type {
  ListingMarket,
  ListingPortal,
  ListingStatus,
  ListingsLifecycle,
  ListingsPurpose,
  UnifiedListingRow,
} from '../types';

export interface UnifiedFilterDraft {
  status?: string;
  propertyType?: string;
  rooms?: string;
  priceValue?: string;
  developerId?: string;
  developerLabel?: string;
  unitNumber?: string;
  portals?: ListingPortal[];
  agentId?: string;
  agentLabel?: string;
}

export interface SellListingsArgs {
  purpose: ListingsPurpose;
  lifecycle: ListingsLifecycle;
  market: ListingMarket;
  search: string;
  filters: UnifiedFilterDraft;
  /** Selected pipeline stage id; undefined = all stages. */
  stageId?: string;
  /** Inclusive ISO (`YYYY-MM-DD`) creation-date window, from the route. */
  dateFrom?: string;
  dateTo?: string;
}

export interface SellListingsState {
  rows: UnifiedListingRow[];
  total: number;
  /** Listing count per stage id (merged across both sources) for the stage pills. */
  stageCounts: Record<string, number>;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  loadMore: () => void;
  refetch: () => void;
}

export function countActiveFilters(f: UnifiedFilterDraft): number {
  let n = 0;
  if (f.status) n += 1;
  if (f.propertyType) n += 1;
  if (f.rooms !== undefined) n += 1;
  if (f.priceValue) n += 1;
  if (f.developerId) n += 1;
  if (f.unitNumber?.trim()) n += 1;
  if (f.portals && f.portals.length > 0) n += 1;
  if (f.agentId) n += 1;
  return n;
}

/**
 * Keeps the object identity of rows whose content has not changed.
 *
 * Every render of the merge memo re-runs `normalize*Row`, so fetching the next
 * page (or refetching) hands back brand-new objects for rows that are byte-for-byte
 * identical to the ones already on screen. That defeats `React.memo` on the list
 * cards and makes the whole list re-render — the "large list is slow to update"
 * warning. Hashing is far cheaper than re-rendering the cards.
 */
function useStableRowIdentity(rows: UnifiedListingRow[]): UnifiedListingRow[] {
  const cache = useRef(new Map<string, { hash: string; row: UnifiedListingRow }>());
  return useMemo(() => {
    const next = new Map<string, { hash: string; row: UnifiedListingRow }>();
    const out = rows.map((row) => {
      const key = `${row.kind}:${row.id}`;
      const hash = JSON.stringify(row);
      const prev = cache.current.get(key);
      const kept = prev?.hash === hash ? prev.row : row;
      next.set(key, { hash, row: kept });
      return kept;
    });
    cache.current = next;
    return out;
  }, [rows]);
}

export function propertyTypeOptionsFromRows(rows: UnifiedListingRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.propertyType) set.add(r.propertyType);
  return [...set].sort((a, b) => a.localeCompare(b));
}

function priceBounds(value: string | undefined): { min?: number; max?: number } {
  const opt = PRICE_OPTIONS.find((o) => o.value === value);
  return opt ? { min: opt.min, max: opt.max } : {};
}

function toTime(row: UnifiedListingRow): number {
  const ms = Date.parse(row.updatedAt ?? '');
  return Number.isNaN(ms) ? 0 : ms;
}

interface RowFilterParams {
  propertyType?: string;
  roomsTarget?: number;
  minPrice?: number;
  maxPrice?: number;
  wantPortals: boolean;
  portals?: ListingPortal[];
}

function bedsMatch(beds: number | null | undefined, target: number): boolean {
  if (beds === null || beds === undefined) return false;
  return target >= 4 ? beds >= 4 : beds === target;
}

function priceInRange(price: number | null, min?: number, max?: number): boolean {
  if (price === null) return false;
  if (min !== undefined && price < min) return false;
  if (max !== undefined && price > max) return false;
  return true;
}

function rowMatchesFilters(row: UnifiedListingRow, p: RowFilterParams): boolean {
  if (p.propertyType && row.propertyType !== p.propertyType) return false;
  if (p.roomsTarget !== undefined && !bedsMatch(row.bedrooms, p.roomsTarget)) return false;
  if (
    (p.minPrice !== undefined || p.maxPrice !== undefined) &&
    !priceInRange(row.price, p.minPrice, p.maxPrice)
  )
    return false;
  if (p.wantPortals) {
    const rowPortals = row.portals ?? [];
    if (!p.portals!.every((portal) => rowPortals.includes(portal))) return false;
  }
  return true;
}

export function useSellListings({
  purpose,
  lifecycle,
  market,
  search,
  filters,
  stageId,
  dateFrom,
  dateTo,
}: SellListingsArgs): SellListingsState {
  const wantPrimary = market === 'all' || market === 'primary';
  const wantSecondary = market === 'all' || market === 'secondary';
  const apiPurpose = purpose === 'rent' ? 'for_rent' : 'for_sale';
  const status = filters.status || undefined;
  const searchParam = search.length > 0 ? search : undefined;

  const primary = usePrimaryListingsInfinite({
    purpose: apiPurpose,
    lifecycle,
    stageId,
    search: searchParam,
    status,
    developerId: filters.developerId,
    assigneeId: filters.agentId,
    dateFrom,
    dateTo,
  });

  const secondary = useListingsInfinite({
    purpose: apiPurpose,
    lifecycle,
    stageId,
    search: searchParam,
    status: status as ListingStatus | undefined,
    agentId: filters.agentId,
    property: filters.unitNumber?.trim() ? filters.unitNumber.trim() : undefined,
    dateFrom,
    dateTo,
  });

  const rawRows = useMemo<UnifiedListingRow[]>(() => {
    const primaryRows = wantPrimary
      ? (primary.data?.pages.flatMap((p) => p.items) ?? []).map(normalizePrimaryRow)
      : [];
    const secondaryRows = wantSecondary
      ? (secondary.data?.pages.flatMap((p) => p.items) ?? []).map(normalizeSecondaryRow)
      : [];
    const merged = [...primaryRows, ...secondaryRows].sort((a, b) => toTime(b) - toTime(a));

    const roomsTarget = filters.rooms !== undefined ? Number(filters.rooms) : undefined;
    const { min: minPrice, max: maxPrice } = priceBounds(filters.priceValue);
    const wantPortals = (filters.portals?.length ?? 0) > 0;
    const filterParams: RowFilterParams = {
      propertyType: filters.propertyType,
      roomsTarget,
      minPrice,
      maxPrice,
      wantPortals,
      portals: filters.portals,
    };

    return merged.filter((row) => rowMatchesFilters(row, filterParams));
  }, [wantPrimary, wantSecondary, primary.data, secondary.data, filters]);

  const rows = useStableRowIdentity(rawRows);

  const total =
    (wantPrimary ? (primary.data?.pages[0]?.total ?? 0) : 0) +
    (wantSecondary ? (secondary.data?.pages[0]?.totalItems ?? 0) : 0);

  const stageCounts = useMemo<Record<string, number>>(() => {
    const merged: Record<string, number> = {};
    const add = (counts: Record<string, number> | undefined): void => {
      if (!counts) return;
      for (const [id, n] of Object.entries(counts)) merged[id] = (merged[id] ?? 0) + n;
    };
    if (wantPrimary) add(primary.data?.pages[0]?.stageCounts);
    if (wantSecondary) add(secondary.data?.pages[0]?.stageCounts);
    return merged;
  }, [wantPrimary, wantSecondary, primary.data, secondary.data]);

  const loadMore = () => {
    if (wantPrimary && primary.hasNextPage && !primary.isFetchingNextPage) {
      primary.fetchNextPage().catch(() => {});
    }
    if (wantSecondary && secondary.hasNextPage && !secondary.isFetchingNextPage) {
      secondary.fetchNextPage().catch(() => {});
    }
  };

  const refetch = () => {
    if (wantPrimary) primary.refetch().catch(() => {});
    if (wantSecondary) secondary.refetch().catch(() => {});
  };

  return {
    rows,
    total,
    stageCounts,
    isLoading: (wantPrimary && primary.isLoading) || (wantSecondary && secondary.isLoading),
    isError: (wantPrimary && primary.isError) || (wantSecondary && secondary.isError),
    isRefetching: primary.isRefetching || secondary.isRefetching,
    isFetchingNextPage: primary.isFetchingNextPage || secondary.isFetchingNextPage,
    hasNextPage:
      (wantPrimary && primary.hasNextPage === true) ||
      (wantSecondary && secondary.hasNextPage === true),
    loadMore,
    refetch,
  };
}
