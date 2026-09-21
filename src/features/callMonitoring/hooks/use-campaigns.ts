import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Campaign } from '../models/campaign';
import { getCampaigns } from '../services';

/**
 * Telesales campaigns list. Cached long — the list rarely changes and is shared
 * by the filter dropdown, list rows, and the detail screen (react-query dedupes
 * every caller onto one request).
 */
export function useCampaigns() {
  return useQuery<Campaign[], Error>({
    queryKey: ['campaigns'],
    queryFn: getCampaigns,
    staleTime: 5 * 60 * 1000,
  });
}

/** `campaignId → name` map for resolving a call's campaign name. */
export function useCampaignMap(): Map<string, string> {
  const { data } = useCampaigns();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data ?? []) map.set(c.id, c.name);
    return map;
  }, [data]);
}
