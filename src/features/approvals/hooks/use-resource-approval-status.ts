import { useQuery } from '@tanstack/react-query';

import { getResourceApprovalStatus } from '../services';

export function useResourceApprovalStatus(
  resourceType: string,
  resourceId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['approvals', 'resource-status', resourceType, resourceId],
    queryFn: () => getResourceApprovalStatus({ resourceType, resourceId }),
    enabled: resourceId !== '' && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}
