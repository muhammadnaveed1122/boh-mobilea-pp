import { useQuery } from '@tanstack/react-query';

import { PERMISSIONS, useCan } from '@/lib/rbac';

import { getApprovalsPendingCount } from '../services';

export interface ApprovalsPendingCount {
  count: number;
  byCategory: Record<string, number>;
}

const EMPTY: ApprovalsPendingCount = { count: 0, byCategory: {} };

/**
 * Total + per-category count of approval requests awaiting the current user's
 * action. Drives the red pending dots on the More tab, the Approvals row and
 * the hub queue cards. Only fetched for users with `approvals:act`; everyone
 * else reads the empty default. Shares one cache key, so all three consumers
 * dedupe. Existing approve/act mutations invalidate `['approvals']`, refreshing it.
 */
export function useApprovalsPendingCount(): ApprovalsPendingCount {
  const canApprovals = useCan(PERMISSIONS.APPROVALS_ACT);
  const { data } = useQuery({
    queryKey: ['approvals', 'pending-count'],
    queryFn: getApprovalsPendingCount,
    enabled: canApprovals,
    staleTime: 30_000,
  });
  return data ?? EMPTY;
}
