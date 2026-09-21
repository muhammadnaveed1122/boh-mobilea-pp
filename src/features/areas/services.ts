/**
 * Areas data access. Hits the same NestJS endpoints the web app uses:
 *   GET /api/v1/locations/neighbourhoods  (paginated, includes per-area counts)
 *   GET /api/v1/locations/states
 *   GET /api/v1/property-types            (authenticated-only; for the filter)
 * The shared apiClient interceptor unwraps the {success,data} envelope, so the
 * resolved `data` is already the payload.
 */
import { apiClient } from '@/lib/api';

import type {
  Area,
  AreaPropertyTypeOption,
  AreaState,
  AreasMeta,
  AreasPage,
  NeighbourhoodsPageParams,
} from './models/area';
import type { AreaListingItem, AreaListingsPage } from './models/area-detail';

const DEFAULT_LIMIT = 100;

function toState(raw: unknown): AreaState {
  const r = (raw ?? {}) as Partial<AreaState>;
  return { id: String(r.id ?? ''), name: String(r.name ?? ''), slug: String(r.slug ?? '') };
}

function toArea(raw: unknown): Area | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  const counts = (r.counts ?? {}) as Partial<Area['counts']>;
  return {
    id: r.id,
    name: r.name,
    slug: typeof r.slug === 'string' ? r.slug : '',
    state: toState(r.state),
    image: (r.image as string | null | undefined) ?? null,
    imageAltText: (r.imageAltText as string | null | undefined) ?? null,
    counts: {
      new: Number(counts.new ?? 0),
      sell: Number(counts.sell ?? 0),
      rent: Number(counts.rent ?? 0),
    },
  };
}

export async function getNeighbourhoodsPage(params: NeighbourhoodsPageParams): Promise<AreasPage> {
  const { page, limit = DEFAULT_LIMIT, search, stateId, propertyType } = params;
  const { data } = await apiClient.get('/api/v1/locations/neighbourhoods', {
    params: {
      page,
      limit,
      sortOrder: 'asc',
      ...(search ? { search } : {}),
      ...(stateId ? { stateId } : {}),
      ...(propertyType ? { propertyType } : {}),
    },
  });
  const body = (data ?? {}) as { items?: unknown[]; meta?: Partial<AreasMeta> };
  const items = (body.items ?? []).map(toArea).filter((a): a is Area => a !== null);
  const meta: AreasMeta = {
    page: Number(body.meta?.page ?? page),
    limit: Number(body.meta?.limit ?? limit),
    total: Number(body.meta?.total ?? items.length),
    totalPages: Number(body.meta?.totalPages ?? 1),
  };
  return { items, meta };
}

export async function getAreaStates(search?: string): Promise<AreaState[]> {
  const { data } = await apiClient.get('/api/v1/locations/states', {
    params: { limit: DEFAULT_LIMIT, sortOrder: 'asc', ...(search ? { search } : {}) },
  });
  const rows = Array.isArray(data) ? data : ((data as { items?: unknown[] })?.items ?? []);
  return rows.map(toState).filter((s) => s.id && s.name);
}

// ─── Area detail: New Projects / Sell / Rent ─────────────────────────────────

const DETAIL_LIMIT = 12;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

function imagesOf(r: Record<string, unknown>): string[] {
  const many = r.heroImageUrls;
  if (Array.isArray(many) && many.length > 0) return many.filter((u): u is string => !!u);
  const one = str(r.heroImageUrl);
  return one ? [one] : [];
}

function formatPriceAed(value: number | null, fallback = 'Price on request'): string {
  return value === null ? fallback : `${value.toLocaleString()} AED`;
}

function formatBedrooms(b: number | null): string {
  if (b === null) return 'N/A';
  return b === 0 ? 'Studio' : `${b}BR`;
}

/** GET /api/v1/projects — New Projects tab. */
function mapProjectRow(raw: unknown): AreaListingItem | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  const area =
    [str(r.neighbourhoodName) ?? str(r.neighborhood), str(r.stateName)]
      .filter(Boolean)
      .join(', ') || '—';
  const developer = (r.developer ?? {}) as Record<string, unknown>;
  const startingPrice = num(r.startingPrice);
  const handover =
    str(r.handoverDate) ?? (r.developmentStage === 'handed_over' ? 'Handed Over' : 'N/A');
  return {
    id: r.id,
    imageUrls: imagesOf(r),
    tag: (str(r.propertyUse) ?? 'project').replaceAll('_', ' '),
    title: str(r.projectName) ?? '—',
    price:
      startingPrice === null
        ? 'Price on request'
        : `${startingPrice.toLocaleString()} AED Starting`,
    updatedAt: str(r.updatedAt) ?? '',
    area,
    secondaryLabel: 'Developer',
    secondaryValue: str(developer.brandName) ?? '—',
    handover,
    bedrooms: str(r.bedroomRange) ?? 'N/A',
    size: str(r.sizeRange) ?? 'N/A',
    serviceCharge: 'N/A',
    listingId: null,
    projectId: r.id,
  };
}

/** GET /api/v1/opportunity-listing — owner listings (Sell/Rent). */
function mapOpportunityRow(raw: unknown): AreaListingItem | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  const builtUp = str(r.builtUpArea);
  return {
    id: r.id,
    imageUrls: imagesOf(r),
    tag: (str(r.propertyUse) ?? str(r.status) ?? 'listing').replaceAll('_', ' '),
    title: str(r.heroTitle) ?? str(r.name) ?? str(r.propertyLabel) ?? '—',
    price: formatPriceAed(num(r.askingPrice)),
    updatedAt: str(r.updatedAt) ?? '',
    area: [str(r.neighbourhoodName), str(r.stateName)].filter(Boolean).join(', ') || '—',
    secondaryLabel: 'Owner',
    secondaryValue: str(r.leadName) ?? '—',
    handover: 'N/A',
    bedrooms: formatBedrooms(num(r.bedrooms)),
    size: builtUp ? `${builtUp} ${str(r.builtUpAreaUnit) ?? 'sqft'}` : 'N/A',
    serviceCharge: 'N/A',
    listingId: r.id,
    projectId: null,
  };
}

/** GET /api/v1/listings — CRM project listings (Sell/Rent). */
function mapCrmRow(raw: unknown): AreaListingItem | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  const project = (r.project ?? {}) as Record<string, unknown>;
  const projectName = str(project.projectName) ?? str(r.projectName) ?? '—';
  const sqft = num(r.sizeSqft);
  return {
    id: r.id,
    imageUrls: imagesOf(r),
    tag: (str(r.propertyUse) ?? 'listing').replaceAll('_', ' '),
    title: str(r.title) ?? projectName,
    price: formatPriceAed(num(r.price)),
    updatedAt: str(r.updatedAt) ?? '',
    area: projectName,
    secondaryLabel: 'Project',
    secondaryValue: projectName,
    handover: 'N/A',
    bedrooms: formatBedrooms(num(r.bedrooms)),
    size: sqft === null ? 'N/A' : `${sqft} sqft`,
    serviceCharge: 'N/A',
    listingId: null,
    projectId: null,
  };
}

interface RawListEnvelope {
  items?: unknown[];
  total?: number;
  totalItems?: number;
  totalPages?: number;
  page?: number;
}

/** New Projects tab — one page. */
export async function getAreaProjectsPage(
  neighbourhoodId: string,
  page: number,
): Promise<AreaListingsPage> {
  const { data } = await apiClient.get('/api/v1/projects', {
    params: { neighbourhoodId, page, limit: DETAIL_LIMIT, sortOrder: 'desc' },
  });
  const body = (data ?? {}) as RawListEnvelope;
  return {
    items: (body.items ?? []).map(mapProjectRow).filter((x): x is AreaListingItem => x !== null),
    page: Number(body.page ?? page),
    totalPages: Number(body.totalPages ?? 1),
    total: Number(body.total ?? 0),
  };
}

/**
 * Sell tab — merges owner (opportunity-listing) + CRM (listings) sources for the
 * same page, mirroring web. Paginates by the larger of the two source totals.
 */
export async function getAreaSellPage(
  neighbourhoodId: string,
  page: number,
): Promise<AreaListingsPage> {
  const [oppRes, crmRes] = await Promise.all([
    apiClient.get('/api/v1/opportunity-listing', {
      params: { neighbourhoodId, page, limit: DETAIL_LIMIT },
    }),
    apiClient.get('/api/v1/listings', {
      params: {
        neighbourhoodId,
        page,
        limit: DETAIL_LIMIT,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    }),
  ]);
  const opp = (oppRes.data ?? {}) as RawListEnvelope;
  const crm = (crmRes.data ?? {}) as RawListEnvelope;
  const items = [
    ...(opp.items ?? []).map(mapOpportunityRow),
    ...(crm.items ?? []).map(mapCrmRow),
  ].filter((x): x is AreaListingItem => x !== null);
  const total = Number(opp.totalItems ?? 0) + Number(crm.total ?? 0);
  const totalPages = Math.max(Number(opp.totalPages ?? 0), Number(crm.totalPages ?? 0), 1);
  return { items, page, totalPages, total };
}

/** Cheap count probes (limit 1) so all tabs can show their counts up-front. */
export async function getAreaCounts(
  neighbourhoodId: string,
): Promise<{ new: number; sell: number }> {
  const [proj, opp, crm] = await Promise.all([
    apiClient.get('/api/v1/projects', { params: { neighbourhoodId, page: 1, limit: 1 } }),
    apiClient.get('/api/v1/opportunity-listing', {
      params: { neighbourhoodId, page: 1, limit: 1 },
    }),
    apiClient.get('/api/v1/listings', { params: { neighbourhoodId, page: 1, limit: 1 } }),
  ]);
  const projBody = (proj.data ?? {}) as RawListEnvelope;
  const oppBody = (opp.data ?? {}) as RawListEnvelope;
  const crmBody = (crm.data ?? {}) as RawListEnvelope;
  return {
    new: Number(projBody.total ?? 0),
    sell: Number(oppBody.totalItems ?? 0) + Number(crmBody.total ?? 0),
  };
}

export async function getAreaPropertyTypes(): Promise<AreaPropertyTypeOption[]> {
  const { data } = await apiClient.get('/api/v1/property-types');
  const rows = (Array.isArray(data) ? data : []) as {
    name?: string;
    slug?: string;
    isActive?: boolean;
  }[];
  return rows
    .filter((r) => r.isActive !== false && typeof r.slug === 'string' && typeof r.name === 'string')
    .map((r) => ({ value: r.slug as string, label: r.name as string }));
}
