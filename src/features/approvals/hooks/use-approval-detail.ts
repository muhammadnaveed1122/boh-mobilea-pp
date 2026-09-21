import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { approveRequest, getApprovalRequest, requestChangesRequest } from '../services';

export function useApprovalDetail(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['approvals', 'request', id],
    queryFn: () => getApprovalRequest(id),
    enabled: id !== '',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['approvals', 'request', id] }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['approvals'], exact: false }).catch(() => {});
  };

  const approveMutation = useMutation({
    mutationFn: (note?: string) => approveRequest(id, note),
    onSuccess: invalidate,
  });

  const requestChangesMutation = useMutation({
    mutationFn: (note: string) => requestChangesRequest(id, note),
    onSuccess: invalidate,
  });

  return {
    request: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    approve: async (note?: string) => {
      await approveMutation.mutateAsync(note);
    },
    requestChanges: async (note: string) => {
      await requestChangesMutation.mutateAsync(note);
    },
    isApproving: approveMutation.isPending,
    isRequestingChanges: requestChangesMutation.isPending,
  };
}
