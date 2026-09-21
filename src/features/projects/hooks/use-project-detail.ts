import { useQuery } from '@tanstack/react-query';

import {
  getProjectById,
  getProjectPaymentPlans,
  getProjectSegments,
  getProjectUnitTypes,
} from '../services';

/**
 * Project-management detail data, mirroring web's `useProjectDetailPage` +
 * `PlansTypesTab` queries: the project itself plus its payment plans, segments
 * and unit types. The Plans & Types queries are gated behind `enabled` so they
 * only fire once the screen mounts with a real id.
 */
const ROOT = 'project-detail';
const STALE = 60_000;

export function useProjectDetail(projectId: string, options?: { enabled?: boolean }) {
  const enabled = (options?.enabled ?? true) && projectId !== '';

  const project = useQuery({
    queryKey: [ROOT, 'project', projectId],
    queryFn: () => getProjectById(projectId),
    enabled,
    staleTime: STALE,
  });

  const paymentPlans = useQuery({
    queryKey: [ROOT, 'payment-plans', projectId],
    queryFn: () => getProjectPaymentPlans(projectId),
    enabled,
    staleTime: STALE,
  });

  const segments = useQuery({
    queryKey: [ROOT, 'segments', projectId],
    queryFn: () => getProjectSegments(projectId),
    enabled,
    staleTime: STALE,
  });

  const unitTypes = useQuery({
    queryKey: [ROOT, 'unit-types', projectId],
    queryFn: () => getProjectUnitTypes(projectId),
    enabled,
    staleTime: STALE,
  });

  return {
    project: project.data ?? null,
    isLoading: project.isLoading,
    isError: project.isError,
    refetch: () => {
      project.refetch();
      paymentPlans.refetch();
      segments.refetch();
      unitTypes.refetch();
    },
    isRefetching:
      project.isRefetching ||
      paymentPlans.isRefetching ||
      segments.isRefetching ||
      unitTypes.isRefetching,
    paymentPlans: paymentPlans.data ?? [],
    isPaymentPlansLoading: paymentPlans.isLoading,
    segments: segments.data ?? [],
    isSegmentsLoading: segments.isLoading,
    unitTypes: unitTypes.data ?? [],
    isUnitTypesLoading: unitTypes.isLoading,
  };
}
