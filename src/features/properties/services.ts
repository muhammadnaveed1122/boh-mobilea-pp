import { apiClient } from '@/lib/api';
import { FEED_FETCH_LIMIT } from './constants';
import type {
  BuyProjectsResponse,
  ListingCallbackLeadPayload,
  OpportunityListResponse,
  PropertyCard,
  PropertyDetail,
} from './types';
import { buyProjectToCards, mergeFeed, opportunityToCard } from './utils/mappers';
import { normalizeBuyListingDetail, normalizeOpportunityDetail } from './utils/normalize-detail';

export type ListingType = 'buy' | 'rent';

/** Buy/Rent projects (`type=buy|rent`) — each nested listing becomes one card. */
async function fetchProjectCards(type: ListingType): Promise<PropertyCard[]> {
  try {
    const { data } = await apiClient.get<BuyProjectsResponse>('/api/v1/public/projects', {
      params: { type, page: 1, limit: FEED_FETCH_LIMIT },
    });
    return (data.items ?? []).flatMap(buyProjectToCards);
  } catch {
    return [];
  }
}

/** Public opportunity (secondary) listings, optionally filtered by purpose. */
async function fetchOpportunityCards(purpose?: 'for_sale' | 'for_rent'): Promise<PropertyCard[]> {
  try {
    const { data } = await apiClient.get<OpportunityListResponse>(
      '/api/v1/opportunity-listing/public',
      {
        params: {
          page: 1,
          limit: FEED_FETCH_LIMIT,
          sortOrder: 'desc',
          ...(purpose ? { purpose } : {}),
        },
      },
    );
    return (data.items ?? [])
      .map(opportunityToCard)
      .filter((card): card is PropertyCard => card !== null);
  } catch {
    return [];
  }
}

/**
 * The mixed feed for a listing type: both sources fetched together, merged
 * newest-first. Each source fails soft (returns []) so one outage doesn't blank
 * the screen. Price labels carry no period suffix — same as web.
 */
export async function getPropertiesFeed(listingType: ListingType = 'buy'): Promise<PropertyCard[]> {
  if (listingType === 'rent') {
    const [rent, opportunity] = await Promise.all([
      fetchProjectCards('rent'),
      fetchOpportunityCards('for_rent'),
    ]);
    return mergeFeed([...rent, ...opportunity]);
  }
  const [buy, opportunity] = await Promise.all([
    fetchProjectCards('buy'),
    fetchOpportunityCards('for_sale'),
  ]);
  return mergeFeed([...buy, ...opportunity]);
}

export async function getBuyListingDetail(
  projectSlug: string,
  listingSlug: string,
): Promise<PropertyDetail> {
  const { data } = await apiClient.get<unknown>(
    `/api/v1/public/projects/${encodeURIComponent(projectSlug)}/${encodeURIComponent(listingSlug)}`,
  );
  return normalizeBuyListingDetail(data);
}

/**
 * Create the "Request Call back" lead from the public listing dialog. `POST /leads` is
 * `@OptionalAuth()` on the backend, so it works signed-out; when a user IS signed in the axios
 * interceptor still attaches the token, same as every other call.
 */
export async function createListingCallbackLead(
  payload: ListingCallbackLeadPayload,
): Promise<{ id?: string }> {
  const { data } = await apiClient.post<{ id?: string }>('/api/v1/leads', payload);
  return data;
}

export async function getOpportunityDetail(slug: string): Promise<PropertyDetail> {
  const { data } = await apiClient.get<unknown>(
    `/api/v1/opportunity-listing/public/${encodeURIComponent(slug)}`,
  );
  return normalizeOpportunityDetail(data);
}
