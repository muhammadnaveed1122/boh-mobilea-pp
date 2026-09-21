import { apiClient } from '@/lib/api';
import { mapPrimaryCmsToDetail, type PrimaryCmsDetailResponse } from './lib/map-primary-detail';
import type {
  ListingDetail,
  ListingDeveloperOption,
  ListingStage,
  PrimaryListingsQuery,
  PrimaryPaginatedListings,
  StageScope,
} from './types';

const PRIMARY_BASE = '/api/v1/listings';
const LISTING_CMS_BASE = '/api/v1/listing-cms';
const DEVELOPERS_BASE = '/api/v1/developers';
const STAGES_BASE = '/api/v1/listing-stages';

/** Fetch a primary (project) listing and map it into the shared detail shape. */
export async function getPrimaryListingDetail(id: string): Promise<ListingDetail> {
  const { data } = await apiClient.get<PrimaryCmsDetailResponse>(`${LISTING_CMS_BASE}/${id}`);
  return mapPrimaryCmsToDetail(data);
}

export async function getPrimaryListings(
  params: PrimaryListingsQuery,
): Promise<PrimaryPaginatedListings> {
  const { data } = await apiClient.get<PrimaryPaginatedListings>(PRIMARY_BASE, {
    params: {
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ...params,
    },
  });
  return data;
}

interface DevelopersResponse {
  items: { id: string; brandName?: string | null; name?: string | null }[];
  page: number;
  totalPages: number;
}

export async function getDevelopers(search?: string): Promise<ListingDeveloperOption[]> {
  const { data } = await apiClient.get<DevelopersResponse>(DEVELOPERS_BASE, {
    params: { page: 1, limit: 100, search: search?.trim() ? search.trim() : undefined },
  });
  return (data.items ?? []).map((d) => ({
    value: d.id,
    label: d.brandName ?? d.name ?? 'Unnamed developer',
  }));
}

/** Ordered pipeline stages for one {domain, purpose, lifecycle} scope. */
export async function getListingStages(scope: StageScope): Promise<ListingStage[]> {
  const { data } = await apiClient.get<ListingStage[]>(STAGES_BASE, { params: scope });
  return Array.isArray(data) ? data : [];
}

/** Move a primary (project) listing to a pipeline stage (null clears it). */
export async function changeListingStage(listingId: string, stageId: string | null): Promise<void> {
  await apiClient.patch(`${PRIMARY_BASE}/${listingId}/stage`, { stageId });
}

/** Assign (or unassign with null) the agent for a primary listing. */
export async function assignListingAgent(
  listingId: string,
  assigneeId: string | null,
): Promise<void> {
  await apiClient.patch(`${PRIMARY_BASE}/${listingId}/assign`, { assigneeId });
}
