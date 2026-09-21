import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { updateLead, createLeadViewing } from '../services';
import type { CreateViewingPayload } from '../types';

export function invalidateLeadsDashboard(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['leads'] });
  qc.invalidateQueries({ queryKey: ['leads', 'overview'] });
  qc.invalidateQueries({ queryKey: ['leads', 'board'] });
  qc.invalidateQueries({ queryKey: ['leads', 'funnel-stats'] });
}

// NOTE: a bare `useUpdateLeadStatus` used to live here. It was removed on purpose —
// a stage change must carry a note (see `StageNoteSheet`), and a note-less status
// writer is exactly the bypass that rule exists to close.

export function useAssignLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) =>
      updateLead(id, { assigneeId }),
    onSuccess: () => invalidateLeadsDashboard(qc),
  });
}

export function useCreateViewing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, payload }: { leadId: string; payload: CreateViewingPayload }) =>
      createLeadViewing(leadId, payload),
    onSuccess: () => invalidateLeadsDashboard(qc),
  });
}
