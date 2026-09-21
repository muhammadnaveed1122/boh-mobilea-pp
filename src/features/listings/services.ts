import { apiClient } from '@/lib/api';
import type { ListingAgent, ListingDetail, ListingsQuery, PaginatedListings } from './types';

const BASE = '/api/v1/opportunity-listing';

export async function getListings(params: ListingsQuery): Promise<PaginatedListings> {
  const { data } = await apiClient.get<PaginatedListings>(BASE, { params });
  return data;
}

export async function getListingById(id: string): Promise<ListingDetail> {
  const { data } = await apiClient.get<ListingDetail>(`${BASE}/${id}`);
  return data;
}

export async function getListingAgents(): Promise<ListingAgent[]> {
  const { data } = await apiClient.get<ListingAgent[]>(`${BASE}/agents`);
  return Array.isArray(data) ? data : [];
}

/** Count of active listings assigned to the current user (assignee-scoped by the backend). */
export async function getActiveListingsCount(): Promise<number> {
  const { data } = await apiClient.get<{ activeListings: number }>(`${BASE}/stats`);
  return data.activeListings ?? 0;
}

/** Move a secondary (opportunity) listing to a pipeline stage (null clears it). */
export async function changeOpportunityListingStage(
  listingId: string,
  stageId: string | null,
): Promise<void> {
  await apiClient.patch(`${BASE}/${listingId}/stage`, { stageId });
}

/** Assign (or unassign with null) the agent for a secondary listing. */
export async function assignOpportunityListing(
  listingId: string,
  assigneeId: string | null,
): Promise<void> {
  await apiClient.patch(`${BASE}/${listingId}/assign`, { assigneeId });
}
