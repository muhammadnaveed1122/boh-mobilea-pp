import { useInfiniteQuery } from '@tanstack/react-query';
import { PAGE_SIZE } from '../constants';
import { extractRecords, extractTotal, type CallsListResponse } from '../models/call-record';
import type { CallLogQuery } from '../models/query';
import { getCallRecords } from '../services';

export function useCallRecords(filters: CallLogQuery, options?: { enabled?: boolean }) {
  return useInfiniteQuery<CallsListResponse, Error>({
    queryKey: ['call-records', filters],
    queryFn: ({ pageParam }) =>
      getCallRecords({
        ...filters,
        limit: PAGE_SIZE,
        offset: (pageParam as number) * PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + extractRecords(p).length, 0);
      const total = extractTotal(last, loaded);
      return loaded < total ? all.length : undefined;
    },
    enabled: options?.enabled ?? true,
  });
}
