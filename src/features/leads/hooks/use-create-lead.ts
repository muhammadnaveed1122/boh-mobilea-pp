import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLead } from '../services';
import type { CreateLeadPayload, LeadListItem } from '../types';

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation<LeadListItem, Error, CreateLeadPayload>({
    mutationFn: createLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] }).catch(() => {});
      qc.invalidateQueries({ queryKey: ['leads', 'funnel-stats'] }).catch(() => {});
    },
  });
}
