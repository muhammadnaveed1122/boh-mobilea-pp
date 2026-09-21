import { apiClient } from '@/lib/api';
import type {
  PublicListingItem,
  PublicProjectDetail,
  PublicProjectsListResponse,
  PublicProjectsQuery,
  StateOption,
} from './types';
import { buildProjectQueryParams } from './utils/filter-params';

export interface PublicListingsResponse {
  items: PublicListingItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getPublicListings(projectId: string): Promise<PublicListingsResponse> {
  const { data } = await apiClient.get<PublicListingsResponse>('/api/v1/public/listings', {
    params: { projectId, status: 'active', limit: 20 },
  });
  return data;
}

export async function getPublicProjects(
  query: PublicProjectsQuery,
): Promise<PublicProjectsListResponse> {
  const params = buildProjectQueryParams(query);
  const { data } = await apiClient.get<PublicProjectsListResponse>('/api/v1/public/projects', {
    params,
  });
  return data;
}

export async function getPublicProjectBySlug(slug: string): Promise<PublicProjectDetail> {
  const { data } = await apiClient.get<PublicProjectDetail>(
    `/api/v1/public/projects/${encodeURIComponent(slug)}`,
  );
  return data;
}

// Backend GET /locations/states returns UAE emirates as { id, name }.
// Map `name` → `city` so filter dropdowns show the emirate labels (mirrors web locationsApi).
interface RawState {
  id: string;
  name?: string;
  city?: string;
}

function toStateOptions(items: RawState[]): StateOption[] {
  return items
    .filter((s) => typeof s.id === 'string')
    .map((s) => ({ id: s.id, city: s.city ?? s.name ?? '' }))
    .filter((s) => s.city.length > 0);
}

export async function getStates(): Promise<StateOption[]> {
  const { data } = await apiClient.get<RawState[] | { items: RawState[] }>(
    '/api/v1/locations/states',
    { params: { sortOrder: 'asc', limit: 100 } },
  );
  if (Array.isArray(data)) return toStateOptions(data);
  if (data && Array.isArray(data.items)) return toStateOptions(data.items);
  return [];
}
