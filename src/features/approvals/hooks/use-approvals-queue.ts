import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { getApprovalQueue } from '../services';
import type {
  ApprovalQueueResponse,
  ApprovalQueueSlug,
  ApprovalRequestStatus,
} from '../models/approval';

export type ApprovalTab = 'Pending' | 'Approved' | 'Changes Requested';

const TAB_TO_STATUS: Record<ApprovalTab, ApprovalRequestStatus> = {
  Pending: 'pending',
  Approved: 'approved',
  'Changes Requested': 'changes_requested',
};

export interface ApprovalsQueueFilters {
  readonly search: string;
  readonly approverId: string;
  readonly agentId: string;
}

const EMPTY_FILTERS: ApprovalsQueueFilters = { search: '', approverId: '', agentId: '' };
const PAGE_LIMIT = 10;

/** Queue state: active tab, filters, paginated data + per-tab counts. */
export function useApprovalsQueue(queue: ApprovalQueueSlug) {
  const [tab, setTab] = React.useState<ApprovalTab>('Pending');
  const [filters, setFilters] = React.useState<ApprovalsQueueFilters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search), 350);
    return () => clearTimeout(id);
  }, [filters.search]);

  const status = TAB_TO_STATUS[tab];

  const query = useInfiniteQuery<ApprovalQueueResponse, Error>({
    queryKey: [
      'approvals',
      queue,
      status,
      { search: debouncedSearch, approverId: filters.approverId, agentId: filters.agentId },
    ],
    queryFn: ({ pageParam }) =>
      getApprovalQueue({
        queue,
        status,
        search: debouncedSearch,
        approverId: filters.approverId,
        agentId: filters.agentId,
        page: pageParam as number,
        limit: PAGE_LIMIT,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 30_000,
  });

  const items = React.useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data],
  );

  const firstCounts = query.data?.pages[0]?.counts;
  const counts = React.useMemo<Record<ApprovalTab, number>>(
    () => ({
      Pending: firstCounts?.pending ?? 0,
      Approved: firstCounts?.approved ?? 0,
      'Changes Requested': firstCounts?.changes_requested ?? 0,
    }),
    [firstCounts],
  );

  const setFilter = React.useCallback(
    <K extends keyof ApprovalsQueueFilters>(key: K, value: ApprovalsQueueFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const reset = React.useCallback(() => setFilters(EMPTY_FILTERS), []);

  return {
    tab,
    setTab,
    filters,
    setFilter,
    reset,
    counts,
    items,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    isError: query.isError,
  };
}
