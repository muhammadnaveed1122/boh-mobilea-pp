import { useMutation, useQueryClient } from '@tanstack/react-query';

import { acknowledgeRequest } from '../services';

export function useAcknowledge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { resourceType: string; resourceId: string; note?: string }) =>
      acknowledgeRequest(params),
    onSuccess: (_data, { resourceType, resourceId }) => {
      queryClient
        .invalidateQueries({ queryKey: ['approvals', 'resource-status', resourceType, resourceId] })
        .catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['approvals'], exact: false }).catch(() => {});
    },
  });
}
