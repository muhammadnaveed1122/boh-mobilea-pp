import { useQueries } from '@tanstack/react-query';

import { getCompareProject, type CompareProject } from '../services';

/**
 * Hydrate the selected projects for the comparison grid. One query per id via
 * `useQueries` (dynamic-length safe). Returns projects in selection order,
 * omitting slots that are still loading or failed to resolve.
 */
export function useCompareData(ids: string[]): {
  projects: CompareProject[];
  isLoading: boolean;
} {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['projects', 'compare', id],
      queryFn: () => getCompareProject(id),
      staleTime: 60_000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const projects = results
    .map((r) => r.data)
    .filter((p): p is CompareProject => p !== null && p !== undefined);

  return { projects, isLoading };
}
