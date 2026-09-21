import { useQuery } from '@tanstack/react-query';
import { getAgents } from '../services';

/**
 * Active agents for assignment / filter pickers. `enabled` lets a caller that
 * only needs the list once a panel opens avoid fetching it on mount — the
 * cache is shared, so a later consumer reads it without a second request.
 */
export function useAgentsList(search?: string, enabled = true) {
  return useQuery({
    queryKey: ['agents', 'list', search ?? ''],
    queryFn: () => getAgents({ search, isActive: true, limit: 50 }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/**
 * Agents the caller may actually assign work to — the picker list, scoped
 * server-side by the `leads:assign` own/team/all scope (mirrors web's
 * `useAgentPickerState`). Kept separate from {@link useAgentsList}, which backs
 * the unscoped assignee *filter* and must keep listing every agent.
 *
 * Deactivated-team agents are intentionally NOT filtered out: the picker shows
 * them disabled rather than hiding the lead's current assignee.
 */
export function useAssignableAgents(search?: string, enabled = true) {
  return useQuery({
    queryKey: ['agents', 'assignable', 'leads', search ?? ''],
    queryFn: () =>
      getAgents({
        search,
        isActive: true,
        accountStatus: 'ACTIVE',
        availability: 'available',
        forAssignment: true,
        assignFor: 'leads',
        limit: 50,
      }),
    enabled,
    staleTime: 5 * 60_000,
  });
}
