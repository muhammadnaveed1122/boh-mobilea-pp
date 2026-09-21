import { useQuery } from '@tanstack/react-query';

import { getApprovers, type ApproverOption } from '../services';

const ALL_APPROVERS: ApproverOption = { value: '', label: 'All Approvers' };

export function useApprovers() {
  const { data } = useQuery({
    queryKey: ['approvals', 'approvers'],
    queryFn: getApprovers,
    staleTime: 5 * 60_000,
  });
  return { options: [ALL_APPROVERS, ...(data ?? [])] };
}
