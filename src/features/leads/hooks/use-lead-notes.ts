import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createLeadNote, deleteLeadNote, getLeadNotes, updateLeadNote } from '../services';

export function useLeadNotes(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-notes', leadId],
    queryFn: () => getLeadNotes(leadId as string),
    enabled: !!leadId,
    staleTime: 30_000,
  });
}

export function useCreateLeadNote(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createLeadNote(leadId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-notes', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useUpdateLeadNote(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { noteId: string; content: string }) =>
      updateLeadNote(leadId, vars.noteId, vars.content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-notes', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useDeleteLeadNote(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { noteId: string }) => deleteLeadNote(leadId, vars.noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-notes', leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
