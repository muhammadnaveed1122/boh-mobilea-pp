import { useQuery } from '@tanstack/react-query';
import {
  geocodeCommunity,
  getLeadDetail,
  getListingUnitTypes,
  getOpportunityDetail,
  getOwnerLeads,
  getOwnerProperties,
  getPortalSettings,
  getPropertyTypes,
  getWizardAgents,
  type GeoPoint,
  type LeadDetail,
  type Opt,
  type OpportunityDetail,
  type PropertyTypeData,
  type UnitTypeOption,
} from '../services';
import {
  PROPERTY_TYPE_GROUPS,
  PROPERTY_USE_BY_TYPE,
  UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE,
} from '../constants';

const FIVE_MIN = 5 * 60 * 1000;

const FALLBACK_PROPERTY_TYPE_DATA: PropertyTypeData = (() => {
  const groupedOptions = PROPERTY_TYPE_GROUPS.flatMap((g) =>
    g.options.map((o) => ({ value: o.value, label: o.label, group: g.title })),
  );
  const unitTypesByType: Record<string, { value: string; label: string }[]> = Object.fromEntries(
    Object.entries(UNIT_TYPE_OPTIONS_BY_PROPERTY_TYPE).map(([k, v]) => [k, [...v]]),
  );
  const useByType: Record<string, 'residential' | 'commercial'> = { ...PROPERTY_USE_BY_TYPE };
  return { groupedOptions, unitTypesByType, useByType };
})();

export function useOwnerLeads() {
  const q = useQuery<Opt[]>({
    queryKey: ['wizard', 'owner-leads'],
    queryFn: () => getOwnerLeads(),
    staleTime: FIVE_MIN,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useOwnerProperties(leadId?: string) {
  const q = useQuery<Opt[]>({
    queryKey: ['wizard', 'owner-properties', leadId],
    queryFn: () => getOwnerProperties(leadId as string),
    enabled: !!leadId,
    staleTime: FIVE_MIN,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useListingUnitTypes(projectId?: string) {
  const q = useQuery<UnitTypeOption[]>({
    queryKey: ['wizard', 'unit-types', projectId],
    queryFn: () => getListingUnitTypes(projectId as string),
    enabled: !!projectId,
    staleTime: FIVE_MIN,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useWizardAgents() {
  const q = useQuery<Opt[]>({
    queryKey: ['wizard', 'agents'],
    queryFn: () => getWizardAgents(),
    staleTime: FIVE_MIN,
  });
  return { data: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

export function useLeadDetailQuery(id?: string) {
  return useQuery<LeadDetail>({
    queryKey: ['wizard', 'lead-detail', id],
    queryFn: () => getLeadDetail(id as string),
    enabled: !!id,
  });
}

export function useOpportunityDetailQuery(id?: string) {
  return useQuery<OpportunityDetail>({
    queryKey: ['wizard', 'opportunity-detail', id],
    queryFn: () => getOpportunityDetail(id ?? ''),
    enabled: !!id,
  });
}

export function usePropertyTypes() {
  const q = useQuery<PropertyTypeData>({
    queryKey: ['wizard', 'property-types'],
    queryFn: getPropertyTypes,
    staleTime: FIVE_MIN,
  });
  const data = q.data && q.data.groupedOptions.length > 0 ? q.data : FALLBACK_PROPERTY_TYPE_DATA;
  return { data, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

const ONE_HOUR = 60 * 60 * 1000;

export function useCommunityGeocode(name?: string) {
  const q = useQuery<GeoPoint | null>({
    queryKey: ['wizard', 'geocode', name],
    queryFn: () => geocodeCommunity(name ?? ''),
    enabled: !!name,
    staleTime: ONE_HOUR,
  });
  return { data: q.data ?? null, isLoading: q.isLoading };
}

/** Whether the admin has enabled the Property Finder portal (gates its toggle). */
export function usePropertyFinderEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ['portal-settings'],
    queryFn: getPortalSettings,
    staleTime: FIVE_MIN,
  });
  return data?.find((s) => s.portal === 'property_finder')?.enabled ?? false;
}
