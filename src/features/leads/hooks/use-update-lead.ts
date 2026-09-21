import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateLead } from '../services';
import type { LeadDetail, UpdateLeadPayload } from '../models/lead-detail';

export function useUpdateLead(id: string) {
  const qc = useQueryClient();
  return useMutation<LeadDetail, Error, Partial<UpdateLeadPayload>>({
    mutationFn: (payload) => updateLead(id, payload),
    onSuccess: (data) => {
      qc.setQueryData(['lead', id], data);
      qc.invalidateQueries({ queryKey: ['leads'] }).catch(() => {});
      // A status change writes a `status_change` LeadNote + an action-log row
      // server-side, so both feeds on the detail screen are now stale.
      qc.invalidateQueries({ queryKey: ['lead-notes', id] }).catch(() => {});
      qc.invalidateQueries({ queryKey: ['lead-activity', id] }).catch(() => {});
    },
  });
}
