import * as React from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getAreaCounts, getAreaProjectsPage, getAreaSellPage } from '../services';
import type { AreaDetailTab, AreaListingItem, AreaListingsPage } from '../models/area-detail';

/**
 * Area-detail data, mirroring web's `useAreaDetail`: a tab switch (New / Sell /
 * Rent) drives which endpoint the active infinite query reads. Counts are a
 * separate cheap probe so all three tabs can show their totals immediately.
 * Rent has no backend source yet (web returns []), so it stays empty.
 */
export function useAreaDetail(neighbourhoodId: string, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && neighbourhoodId !== '';
  const [tab, setTab] = React.useState<AreaDetailTab>('new');

  const countsQuery = useQuery({
    queryKey: ['area-detail', 'counts', neighbourhoodId],
    queryFn: () => getAreaCounts(neighbourhoodId),
    enabled,
    staleTime: 60_000,
  });

  const list = useInfiniteQuery<AreaListingsPage, Error>({
    queryKey: ['area-detail', 'list', neighbourhoodId, tab],
    queryFn: ({ pageParam }) => {
      const page = pageParam as number;
      if (tab === 'new') return getAreaProjectsPage(neighbourhoodId, page);
      if (tab === 'sell') return getAreaSellPage(neighbourhoodId, page);
      return Promise.resolve({ items: [], page: 1, totalPages: 1, total: 0 });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: enabled && tab !== 'rent',
    staleTime: 30_000,
  });

  const items: AreaListingItem[] = React.useMemo(
    () => (tab === 'rent' ? [] : (list.data?.pages.flatMap((p) => p.items) ?? [])),
    [tab, list.data],
  );

  const counts = React.useMemo(
    () => ({ new: countsQuery.data?.new ?? 0, sell: countsQuery.data?.sell ?? 0, rent: 0 }),
    [countsQuery.data],
  );

  return {
    tab,
    setTab,
    items,
    counts,
    isLoading: tab !== 'rent' && list.isLoading,
    isError: list.isError,
    isRefetching: list.isRefetching,
    refetch: () => {
      countsQuery.refetch();
      list.refetch();
    },
    fetchNextPage: list.fetchNextPage,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
  };
}
