import { apiClient } from '@/lib/api';
import { decryptLeadContact } from '@/lib/contact-encryption';
import type { PublishOverrideStatus, ReviewFieldsRaw } from './review-state';
import type { Opt } from './types';
import type { WizardDocItem, WizardMediaItem } from './media/types';

interface PageMeta {
  page?: number;
  totalPages?: number;
  total?: number;
  totalItems?: number;
}

interface Paginated<T> extends PageMeta {
  items: T[];
  /** Some endpoints (e.g. /locations/neighbourhoods) nest pagination under `meta`. */
  meta?: PageMeta;
}

export interface RemotePage<T = Opt> {
  items: T[];
  page: number;
  hasMore: boolean;
}

/**
 * Derive "is there a next page" without depending on one specific metadata
 * field: prefer totalPages, else total/totalItems, else fall back to "a full
 * page came back ⇒ assume more". Robust to varying backend envelopes.
 */
function deriveHasMore(meta: PageMeta, page: number, limit: number, returned: number): boolean {
  if (typeof meta.totalPages === 'number') return page < meta.totalPages;
  const total = meta.total ?? meta.totalItems;
  if (typeof total === 'number') return page * limit < total;
  return returned === limit;
}

export async function getNeighbourhoodsPage(args: {
  search: string;
  page: number;
  limit?: number;
}): Promise<RemotePage> {
  const limit = args.limit ?? 20;
  const { data } = await apiClient.get<Paginated<{ id: string; name: string }>>(
    '/api/v1/locations/neighbourhoods',
    {
      params: {
        page: args.page,
        limit,
        search: args.search.trim() || undefined,
      },
    },
  );
  const items = (data.items ?? []).map((n) => ({ value: n.id, label: n.name }));
  // Pagination meta may be top-level or nested under `meta` depending on endpoint.
  const meta: PageMeta = data.meta ?? data;
  return {
    items,
    page: args.page,
    hasMore: deriveHasMore(meta, args.page, limit, items.length),
  };
}

/**
 * Extract an array from varying backend envelopes: bare array, `{ data: [...] }`
 * (success envelope used by /listings/projects + /listings/unit-types), or
 * `{ items: [...] }` (paginated). Returns [] otherwise.
 */
function unwrapArray<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === 'object') {
    const rec = body as Record<string, unknown>;
    if (Array.isArray(rec.data)) return rec.data as T[];
    if (Array.isArray(rec.items)) return rec.items as T[];
  }
  return [];
}

export interface ProjectOption extends Opt {
  developerId?: string | null;
  developerName?: string | null;
}

export interface UnitTypeOption extends Opt {
  usedPurposes?: string[];
}

export interface LeadDetail {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  secondaryPhone?: string | null;
  source?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  nationality?: string | null;
  languages?: string[] | null;
  spokenLanguages?: string[] | null;
  assigneeId?: string | null;
  assignee?: { id?: string | null } | null;
  /** Owner extras the backend nests under `data`. */
  data?: {
    gender?: string | null;
    birthdate?: string | null;
    sourceOfOwner?: string | null;
    nationality?: string | null;
    spokenLanguages?: string[] | null;
  } | null;
}

export async function getOwnerLeads(search?: string): Promise<Opt[]> {
  const { data } = await apiClient.get<
    Paginated<{ id: string; name?: string | null; email?: string | null }>
  >('/api/v1/leads', {
    params: {
      interest: 'seller',
      search: search?.trim() || undefined,
      page: 1,
      perPage: 50,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },
  });
  return (data.items ?? []).map((l) => ({
    value: l.id,
    label: l.name?.trim() ? l.name : (l.email ?? 'Unnamed lead'),
  }));
}

export async function getLeadDetail(id: string): Promise<LeadDetail> {
  // Leads are fetched by `?id=` query (there is no `/leads/:id` GET route), and
  // contact fields come back encrypted — decrypt before use.
  const { data } = await apiClient.get<LeadDetail | { items?: LeadDetail[] }>('/api/v1/leads', {
    params: { id },
  });
  const items = (data as { items?: LeadDetail[] }).items;
  const lead = Array.isArray(items) ? items[0] : (data as LeadDetail);
  if (!lead || !('id' in lead)) {
    throw new Error('Lead not found');
  }
  return decryptLeadContact(lead);
}

export async function getOwnerProperties(leadId: string, search?: string): Promise<Opt[]> {
  const { data } = await apiClient.get<
    Paginated<{ id: string; projectBuilding?: string | null; unitNumber?: string | null }>
  >('/api/v1/opportunities', {
    params: { leadId, search: search?.trim() || undefined, limit: 20 },
  });
  return (data.items ?? []).map((o) => ({
    value: o.id,
    label: o.projectBuilding?.trim() ? o.projectBuilding : `Unit ${o.unitNumber ?? ''}`.trim(),
  }));
}

interface ProjectListItem {
  id: string;
  projectName?: string | null;
  developerId?: string | null;
  developer?: { id?: string | null; brandName?: string | null } | null;
}

/**
 * Paginated project picker — mirrors the web wizard, which hits the public
 * `/projects` list (page/limit/search, sorted by name) and reads items + page +
 * totalPages from the nested `data` envelope. (The `/listings/projects` route is
 * developer-scoped and unpaginated — not what the picker uses.)
 */
export async function getListingProjectsPage(args: {
  search: string;
  page: number;
  limit?: number;
}): Promise<RemotePage<ProjectOption>> {
  const limit = args.limit ?? 20;
  // apiClient unwraps the { success, data } envelope, so `data` is the inner
  // pagination payload. Fall back to a nested `data` just in case a path isn't
  // enveloped.
  const { data } = await apiClient.get<{
    items?: ProjectListItem[];
    page?: number;
    totalPages?: number;
    data?: { items?: ProjectListItem[]; page?: number; totalPages?: number };
  }>('/api/v1/projects', {
    params: {
      page: args.page,
      limit,
      search: args.search.trim() || undefined,
      sortBy: 'projectName',
      sortOrder: 'asc',
    },
  });
  const payload = data.data ?? data;
  const rows = payload.items ?? [];
  const page = payload.page ?? args.page;
  return {
    items: rows.map((p) => ({
      value: p.id,
      label: p.projectName ?? p.id,
      developerId: p.developerId || p.developer?.id || null,
      developerName: p.developer?.brandName ?? null,
    })),
    page,
    hasMore:
      typeof payload.totalPages === 'number' ? page < payload.totalPages : rows.length === limit,
  };
}

export async function getListingUnitTypes(projectId: string): Promise<UnitTypeOption[]> {
  const { data } = await apiClient.get<unknown>('/api/v1/listings/unit-types', {
    params: { projectId },
  });
  const rows = unwrapArray<{
    id: string;
    displayLabel?: string | null;
    unitType?: string | null;
    usedPurposes?: string[];
  }>(data);
  return rows.map((u) => ({
    value: u.id,
    label: u.displayLabel ?? u.unitType ?? u.id,
    usedPurposes: u.usedPurposes ?? [],
  }));
}

export async function getWizardAgents(): Promise<Opt[]> {
  const { data } = await apiClient.get<
    Paginated<{
      id: string;
      email?: string | null;
      profile?: {
        fullName?: string | null;
        firstName?: string | null;
        lastName?: string | null;
      } | null;
    }>
  >('/api/v1/agents', { params: { page: 1, limit: 100, isActive: true } });
  return (data.items ?? []).map((a) => {
    const full = a.profile?.fullName?.trim();
    const composed = [a.profile?.firstName, a.profile?.lastName].filter(Boolean).join(' ').trim();
    return { value: a.id, label: full || composed || (a.email ?? 'Agent') };
  });
}

export interface OpportunityDetail {
  id?: string | null;
  leadId?: string | null;
  purpose?: string | null;
  propertyType?: string | null;
  propertyUse?: string | null;
  neighbourhoodId?: string | null;
  neighbourhood?: { id?: string | null; name?: string | null } | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  builtUpArea?: string | null;
  unitType?: string | null;
  furnishing?: string | null;
  view?: string | null;
  projectBuilding?: string | null;
  towerBlock?: string | null;
  unitNumber?: string | null;
  floor?: string | null;
  buildingProjectAddress?: string | null;
  askingPrice?: string | null;
  priceType?: string | null;
  maxCheques?: number | null;
  deposit?: string | null;
  mortgageStatus?: string | null;
}

export async function getOpportunityDetail(id: string): Promise<OpportunityDetail> {
  const { data } = await apiClient.get<OpportunityDetail>(`/api/v1/opportunities/${id}`);
  return data;
}

interface PlatformPropertyType {
  slug: string;
  name: string;
  isActive: boolean;
  propertyUse?: string;
  unitTypes: { slug: string; name: string; isActive: boolean }[];
}

export interface PropertyTypeData {
  groupedOptions: { value: string; label: string; group: string }[];
  unitTypesByType: Record<string, { value: string; label: string }[]>;
  useByType: Record<string, 'residential' | 'commercial'>;
}

export async function getPropertyTypes(): Promise<PropertyTypeData> {
  const { data } = await apiClient.get<PlatformPropertyType[]>('/api/v1/property-types');
  const active = (data ?? []).filter((pt) => pt.isActive);

  const residential = active.filter((pt) => pt.propertyUse !== 'commercial');
  const commercial = active.filter((pt) => pt.propertyUse === 'commercial');

  const groupedOptions = [
    ...residential.map((pt) => ({ value: pt.slug, label: pt.name, group: 'Residential' })),
    ...commercial.map((pt) => ({ value: pt.slug, label: pt.name, group: 'Commercial' })),
  ];

  const unitTypesByType: Record<string, { value: string; label: string }[]> = {};
  for (const pt of active) {
    unitTypesByType[pt.slug] = (pt.unitTypes ?? [])
      .filter((ut) => ut.isActive)
      .map((ut) => ({ value: ut.slug, label: ut.name }));
  }

  const useByType: Record<string, 'residential' | 'commercial'> = {};
  for (const pt of active) {
    useByType[pt.slug] = pt.propertyUse === 'commercial' ? 'commercial' : 'residential';
  }

  return { groupedOptions, unitTypesByType, useByType };
}

// ---------------------------------------------------------------------------
// Create (wizard submit) — mirrors the web wizard's endpoints.
//   Primary branch   → POST /listings           (creates a draft project listing)
//   Secondary branch → POST /leads + /opportunities (owner lead + property opportunity)
// apiClient unwraps the { success, data } envelope, so each returns the inner row.
// ---------------------------------------------------------------------------

/** Per-listing property details persisted on the Listing row (primary). All optional. */
export interface ListingPropertyDetailsBody {
  propertyType?: string;
  neighbourhoodId?: string;
  price?: string;
  bedrooms?: number;
  bathrooms?: number;
  size?: string;
  viewType?: string;
  furnishing?: string;
  floor?: string;
  totalFloors?: string;
  buildYear?: string;
  occupancy?: string;
  parking?: string;
  publicUnitNo?: string;
  privateUnitNo?: string;
  availabilityDate?: string;
  mortgageStatus?: string;
  priceType?: string;
  maxCheques?: number;
  deposit?: string;
}

export interface CreatePrimaryListingBody extends ListingPropertyDetailsBody {
  developerId: string;
  projectId: string;
  /** Optional — omit entirely when no unit type chosen (backend rejects an empty UUID). */
  unitTypeId?: string;
  purpose: 'for_sale' | 'for_rent';
  availability: string;
  assigneeId?: string;
  completionStatus?: string;
}

export async function createPrimaryListing(
  body: CreatePrimaryListingBody,
): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>('/api/v1/listings', body);
  return data;
}

export interface CreateLeadBody {
  name?: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  leadType: 'manual';
  data?: Record<string, unknown>;
}

export async function createLead(body: CreateLeadBody): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>('/api/v1/leads', body);
  return data;
}

export interface CreateOpportunityBody {
  leadId: string;
  purpose?: 'for_sale' | 'for_rent';
  builtUpArea?: string;
  unitNumber?: string;
  neighbourhoodId?: string;
  propertyUse?: string;
  propertyType?: string;
  unitType?: string;
  bedrooms?: number;
  bathrooms?: number;
  furnishing?: string;
  view?: string;
  projectBuilding?: string;
  towerBlock?: string;
  floor?: string;
  buildingProjectAddress?: string;
  askingPrice?: string;
  mortgageStatus?: string;
  priceType?: string;
  maxCheques?: number;
  deposit?: string;
}

export async function createOpportunity(body: CreateOpportunityBody): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>('/api/v1/opportunities', body);
  return data;
}

// ---------------------------------------------------------------------------
// Update (edit mode) — mirrors the web wizard's edit saves. Property/pricing on
// the Opportunity, owner on the Lead, primary core on the Listing, and primary
// property details through the listing wizard-state PATCH.
// ---------------------------------------------------------------------------

/** Secondary — update the property/pricing opportunity (leadId is immutable, omit it). */
export async function updateOpportunity(
  id: string,
  body: Partial<Omit<CreateOpportunityBody, 'leadId'>>,
): Promise<void> {
  await apiClient.patch(`/api/v1/opportunities/${id}`, body);
}

/** Secondary — update the owner lead (name/phone/email + `data` extras). */
export async function updateListingLead(id: string, body: Partial<CreateLeadBody>): Promise<void> {
  await apiClient.patch(`/api/v1/leads/${id}`, body);
}

/** Owner-first owner record (flat columns — no `data` bag, unlike a lead). */
export interface UpdateOwnerBody {
  name?: string;
  email?: string;
  phone?: string;
  secondaryPhone?: string;
  source?: string;
  nationality?: string;
  gender?: string;
  birthdate?: string;
  spokenLanguages?: string[];
  assigneeId?: string;
}

/** Secondary — update the owner-first Owner record (modern listings have no lead). */
export async function updateListingOwner(id: string, body: UpdateOwnerBody): Promise<void> {
  await apiClient.patch(`/api/v1/owners/${id}`, body);
}

/** Primary — update the listing's purpose/availability/assignee (core row). */
export async function updatePrimaryListingCore(
  id: string,
  body: { purpose?: 'for_sale' | 'for_rent'; availability?: string; assigneeId?: string },
): Promise<void> {
  await apiClient.patch(`/api/v1/listings/${id}`, body);
}

/** Primary — update per-listing property/pricing details via the wizard-state PATCH. */
export async function updatePrimaryListingDetails(
  id: string,
  details: ListingPropertyDetailsBody,
): Promise<void> {
  await apiClient.patch(`/api/v1/listings/${id}/wizard-state`, { step: 1, ...details });
}

// ---------------------------------------------------------------------------
// Edit prefill — rich raw fetches for hydrating the wizard's text sections and
// meta. (Media re-uses getOpportunityListingMedia / getPrimaryListingMedia.)
// ---------------------------------------------------------------------------

/** Property Finder id as returned in edit payloads (string or numeric). */
export type EditPfId = string | number | null;

export interface EditSectionsRaw {
  hero?: {
    title?: string | null;
    subtitle?: string | null;
    mainTitle?: string | null;
    subTitle?: string | null;
    description?: string | null;
    videoLink?: string | null;
    view360Link?: string | null;
  } | null;
  about?: {
    title?: string | null;
    subtitle?: string | null;
    mainTitle?: string | null;
    subTitle?: string | null;
    textSection1?: string | null;
    textSection2?: string | null;
    additionalDescription?: string | null;
  } | null;
  highlights?: {
    title?: string | null;
    subtitle?: string | null;
    mainHeading?: string | null;
    segmentName?: string | null;
    publicPrice?: number | null;
    price?: number | null;
  } | null;
  location?: {
    title?: string | null;
    subtitle?: string | null;
    tagline?: string | null;
    locationName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    mapCenter?: { latitude: number; longitude: number } | null;
  } | null;
  seo?: {
    metaTitle?: string | null;
    urlSlug?: string | null;
    metaDescription?: string | null;
  } | null;
  seoSettings?: {
    metaTitle?: string | null;
    urlSlug?: string | null;
    metaDescription?: string | null;
  } | null;
}

export interface EditPermitRaw {
  status?: string | null;
  permitNumber?: string | null;
  permitDocumentUrl?: string | null;
  permitUrl?: string | null;
  applicationDate?: string | null;
  approvalDate?: string | null;
  expiryDate?: string | null;
  rejectedDate?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
  qrCodeUrl?: string | null;
  qrCodeAltText?: string | null;
}

export interface EditAmenityRaw {
  id: string;
  amenityId?: string | null;
}

/**
 * Owner block embedded on the opportunity-listing read (owner-first listings).
 * Modern listings hang the owner off the Owner table (no Lead row at all), so the
 * edit prefill reads it from here and only falls back to the legacy lead fetch
 * when this block is absent/null.
 */
export interface EditOwnerRaw {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  secondaryPhone?: string | null;
  source?: string | null;
  nationality?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  spokenLanguages?: string[] | null;
  isDraft?: boolean | null;
  assignee?: { id?: string | null } | null;
}

export interface SecondaryListingRaw extends ReviewFieldsRaw {
  id: string;
  name?: string | null;
  opportunityId?: string | null;
  /** Embedded owner (owner-first listings); null/absent on legacy lead-based ones. */
  owner?: EditOwnerRaw | null;
  completionStatus?: string | null;
  wizardState?: { purpose?: string | null; publish?: { publishToPortal?: boolean } | null } | null;
  pfAgentId?: EditPfId;
  pfLocationId?: EditPfId;
  pfPriceHidden?: boolean | null;
  pfPublishAsDraft?: boolean | null;
  sections?: EditSectionsRaw | null;
  amenities?: EditAmenityRaw[] | null;
  trakheesiPermit?: EditPermitRaw | null;
}

export async function getSecondaryListingRaw(id: string): Promise<SecondaryListingRaw> {
  const { data } = await apiClient.get<SecondaryListingRaw>(`/api/v1/opportunity-listing/${id}`);
  return data;
}

export interface PrimaryListingRaw extends ReviewFieldsRaw {
  listingId?: string;
  id?: string;
  completionStatus?: string | null;
  purpose?: string | null;
  availability?: string | null;
  developerId?: string | null;
  projectId?: string | null;
  unitTypeId?: string | null;
  neighbourhoodId?: string | null;
  neighbourhoodName?: string | null;
  propertyType?: string | null;
  assigneeId?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  size?: number | null;
  viewType?: string | null;
  furnishing?: string | null;
  floor?: string | null;
  totalFloors?: string | null;
  buildYear?: string | null;
  occupancy?: string | null;
  parking?: string | null;
  publicUnitNo?: string | null;
  privateUnitNo?: string | null;
  availabilityDate?: string | null;
  mortgageStatus?: string | null;
  priceType?: string | null;
  maxCheques?: number | null;
  deposit?: string | null;
  pfLocationId?: EditPfId;
  pfPublishAsDraft?: boolean | null;
  wizardState?: { publish?: { publishToPortal?: boolean } | null } | null;
  sections?: EditSectionsRaw | null;
  amenities?: EditAmenityRaw[] | null;
  trakheesiPermit?: EditPermitRaw | null;
}

export async function getPrimaryListingRaw(id: string): Promise<PrimaryListingRaw> {
  const { data } = await apiClient.get<PrimaryListingRaw>(`/api/v1/listing-cms/${id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Review workflow — submit / approve / request-changes / (un)publish + history.
// One PATCH .../publish endpoint per kind; the body distinguishes the action
// (see review-state.ts + the design spec). Mirrors the web wizard's `finish`.
// ---------------------------------------------------------------------------

export interface PublishListingBody {
  isPublished: boolean;
  status?: PublishOverrideStatus;
  changeNotes?: string;
  agentNotes?: string;
}

export async function publishOpportunityListing(
  listingId: string,
  body: PublishListingBody,
): Promise<void> {
  await apiClient.patch(`/api/v1/opportunity-listing/${listingId}/publish`, body);
}

export async function publishListingCms(
  listingId: string,
  body: PublishListingBody,
): Promise<void> {
  await apiClient.patch(`/api/v1/listing-cms/${listingId}/publish`, body);
}

/** A single field diff on a submission event (label + before → after). */
export interface ReviewFieldChange {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
}

export interface ReviewHistoryOwner {
  id?: string;
  name: string | null;
}

export interface ReviewHistoryAssignment {
  assignedBy: ReviewHistoryOwner | null;
  previousOwner: ReviewHistoryOwner | null;
  newOwner: ReviewHistoryOwner | null;
  notes: string | null;
}

/**
 * Normalized timeline entry consumed by the Activity sheet — full parity with
 * the web `ReviewHistoryEntry`: status transitions, stage changes, field diffs,
 * assignment detail, and change/agent notes all come off the entry's metadata.
 */
export interface ReviewHistoryEntry {
  id: string;
  eventType: string;
  actorName: string | null;
  createdAt: string;
  fromStatus: string | null;
  toStatus: string | null;
  changeNotes: string | null;
  agentNotes: string | null;
  stageName: string | null;
  previousStageName: string | null;
  reason: string | null;
  fieldChanges: ReviewFieldChange[];
  assignment: ReviewHistoryAssignment | null;
}

interface HistoryMetaRaw {
  fromStatus?: string | null;
  toStatus?: string | null;
  changeNotes?: string | null;
  agentNotes?: string | null;
  note?: string | null;
  stageName?: string | null;
  previousStageName?: string | null;
  reason?: string | null;
  fieldChanges?: unknown;
  statusChange?: { fromStatus?: string | null; toStatus?: string | null } | null;
}

interface HistoryOwnerRaw {
  id?: string | null;
  name?: string | null;
}

interface HistoryEntryRaw {
  id?: string | null;
  eventType?: string | null;
  actor?: HistoryOwnerRaw | null;
  metadata?: HistoryMetaRaw | null;
  assignment?: {
    assignedBy?: HistoryOwnerRaw | null;
    previousOwner?: HistoryOwnerRaw | null;
    newOwner?: HistoryOwnerRaw | null;
    notes?: string | null;
  } | null;
  createdAt?: string | null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function toOwner(raw: HistoryOwnerRaw | null | undefined): ReviewHistoryOwner | null {
  if (!raw) return null;
  return { id: raw.id ?? undefined, name: raw.name ?? null };
}

function toFieldChanges(raw: unknown): ReviewFieldChange[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): ReviewFieldChange | null => {
      if (typeof item !== 'object' || item === null) return null;
      const r = item as Record<string, unknown>;
      const field = typeof r['field'] === 'string' ? r['field'] : '';
      const label = typeof r['label'] === 'string' ? r['label'] : field;
      if (!label) return null;
      const asText = (v: unknown): string | null =>
        v === null || v === undefined ? null : String(v);
      return { field, label, before: asText(r['before']), after: asText(r['after']) };
    })
    .filter((c): c is ReviewFieldChange => c !== null);
}

function toAssignment(e: HistoryEntryRaw): ReviewHistoryAssignment | null {
  if (!e.assignment) return null;
  return {
    assignedBy: toOwner(e.assignment.assignedBy),
    previousOwner: toOwner(e.assignment.previousOwner),
    newOwner: toOwner(e.assignment.newOwner),
    notes: cleanString(e.assignment.notes),
  };
}

function normalizeHistory(rows: unknown): ReviewHistoryEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row, index): ReviewHistoryEntry => {
    const e = (typeof row === 'object' && row !== null ? row : {}) as HistoryEntryRaw;
    const meta = e.metadata ?? {};
    return {
      id: e.id ?? `history-${index}`,
      eventType: e.eventType ?? 'updated',
      actorName: e.actor?.name ?? null,
      createdAt: e.createdAt ?? '',
      fromStatus: meta.fromStatus ?? meta.statusChange?.fromStatus ?? null,
      toStatus: meta.toStatus ?? meta.statusChange?.toStatus ?? null,
      changeNotes: cleanString(meta.changeNotes) ?? cleanString(meta.note),
      agentNotes: cleanString(meta.agentNotes),
      stageName: cleanString(meta.stageName),
      previousStageName: cleanString(meta.previousStageName),
      reason: cleanString(meta.reason),
      fieldChanges: toFieldChanges(meta.fieldChanges),
      assignment: toAssignment(e),
    };
  });
}

export async function getOpportunityListingHistory(
  listingId: string,
): Promise<ReviewHistoryEntry[]> {
  const { data } = await apiClient.get<unknown>(`/api/v1/opportunity-listing/${listingId}/history`);
  return normalizeHistory(data);
}

export async function getListingCmsHistory(listingId: string): Promise<ReviewHistoryEntry[]> {
  const { data } = await apiClient.get<unknown>(`/api/v1/listing-cms/${listingId}/history`);
  return normalizeHistory(data);
}

// ---------------------------------------------------------------------------
// Listing content (Description step) — mirrors the web wizard's hero save.
//   Secondary → POST /opportunity-listing/opportunity/:id  then  POST .../:listingId/hero
//   Primary   → POST /listing-cms/:listingId?section=hero
// Hero endpoints are multipart (they also accept media); here we send text only.
// ---------------------------------------------------------------------------

export interface HeroFields {
  title: string;
  description: string;
}

/** Secondary branch — create the opportunity-listing row for a saved opportunity. */
export async function createOpportunityListing(
  opportunityId: string,
  body: { name?: string },
): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>(
    `/api/v1/opportunity-listing/opportunity/${opportunityId}`,
    body,
  );
  return data;
}

/** Secondary branch — upsert the hero section (title + description) as multipart. */
export async function upsertOpportunityListingHero(
  listingId: string,
  fields: HeroFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('title', fields.title);
  fd.append('subtitle', '');
  fd.append('description', fields.description);
  fd.append('videoLink', '');
  fd.append('view360Link', '');
  fd.append('existingMedia', '[]');
  fd.append('newMediaAltTexts', '[]');
  await apiClient.post(`/api/v1/opportunity-listing/${listingId}/hero`, fd, {
    headers: { 'Content-Type': undefined },
  });
}

/** Primary branch — upsert the CMS hero section (title + description) as multipart. */
export async function upsertPrimaryListingHero(
  listingId: string,
  fields: HeroFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('mainTitle', fields.title);
  fd.append('subTitle', '');
  fd.append('description', fields.description);
  fd.append('existingMedia', '[]');
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=hero`, fd, {
    headers: { 'Content-Type': undefined, 'X-Use-FormData': 'true' },
  });
}

// Re-export Opt type so hooks task can import from ../services
export type { Opt } from './types';

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export async function geocodeCommunity(name: string): Promise<GeoPoint | null> {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  // Try the full label, then progressively drop the leading (most specific)
  // comma-segment so a marketing name like "Verona, Damac Hills 2, Dubai" still
  // resolves via "Damac Hills 2, Dubai".
  const parts = name
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const queries = parts
    .map((_, i) => parts.slice(i).join(', '))
    .filter((q, i, all) => all.indexOf(q) === i);

  for (const q of queries) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        `${q}, UAE`,
      )}&key=${key}`;
      const res = await fetch(url);
      const json = (await res.json()) as {
        status: string;
        results: { geometry: { location: { lat: number; lng: number } } }[];
      };
      const loc = json.results[0]?.geometry?.location;
      if (json.status === 'OK' && loc) {
        return { latitude: loc.lat, longitude: loc.lng };
      }
    } catch {
      // Try the next, less-specific candidate.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Media & Documents (Step 3) — hero media, about images, owner documents.
// Files are RN objects appended to FormData; Content-Type undefined lets RN set the boundary.
// ---------------------------------------------------------------------------

export interface HeroMediaFields {
  title: string;
  description: string;
  videoLink: string;
  view360Link: string;
  media: WizardMediaItem[];
}

export interface AboutImageFields {
  image1: WizardMediaItem | null;
  image2: WizardMediaItem | null;
}

export interface ListingMedia {
  hero: WizardMediaItem[];
  about1: WizardMediaItem | null;
  about2: WizardMediaItem | null;
}

/** File part for RN multipart. Cast matches the repo's chat upload pattern. */
function filePart(item: { uri: string; name: string; mimeType: string }): Blob {
  return { uri: item.uri, name: item.name, type: item.mimeType } as unknown as Blob;
}

/** Hero item first, then remaining by `order`. Used to place the hero at sortOrder 0. */
function sortHeroFirst(media: WizardMediaItem[]): WizardMediaItem[] {
  return [...media].sort((a, b) => {
    if (a.isHero !== b.isHero) return a.isHero ? -1 : 1;
    return a.order - b.order;
  });
}

export interface ServerMediaItem {
  id: string;
  mediaType?: string | null;
  mediaUrl: string;
  altText?: string | null;
  sortOrder?: number | null;
  isHero?: boolean | null;
}

export function mapServerMedia(m: ServerMediaItem, index: number): WizardMediaItem {
  const order = typeof m.sortOrder === 'number' ? m.sortOrder : index;
  return {
    id: m.id,
    url: m.mediaUrl,
    name: '',
    mimeType: '',
    type: m.mediaType === 'video' ? 'video' : 'image',
    altText: m.altText ?? '',
    isHero: m.isHero ?? order === 0,
    order,
  };
}

// --- Secondary (opportunity-listing) --------------------------------------

export async function upsertOpportunityListingHeroMedia(
  listingId: string,
  fields: HeroMediaFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('title', fields.title);
  fd.append('subtitle', '');
  fd.append('description', fields.description);
  fd.append('videoLink', fields.videoLink);
  fd.append('view360Link', fields.view360Link);
  const sorted = sortHeroFirst(fields.media);
  const existing = sorted
    .filter((m) => m.id !== undefined)
    .map((m, i) => ({ id: m.id, altText: m.altText, sortOrder: i }));
  fd.append('existingMedia', JSON.stringify(existing));
  const newAlts: string[] = [];
  for (const m of sorted) {
    if (m.id === undefined && m.uri !== undefined) {
      fd.append('files', filePart({ uri: m.uri, name: m.name, mimeType: m.mimeType }));
      newAlts.push(m.altText);
    }
  }
  fd.append('newMediaAltTexts', JSON.stringify(newAlts));
  await apiClient.post(`/api/v1/opportunity-listing/${listingId}/hero`, fd, {
    headers: { 'Content-Type': undefined },
  });
}

export async function upsertOpportunityListingAbout(
  listingId: string,
  fields: AboutImageFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('title', '');
  fd.append('subtitle', '');
  fd.append('textSection1', '');
  fd.append('textSection2', '');
  fd.append('additionalDescription', '');
  applyAboutSlot(fd, 'image1', 'image1AltText', 'removeImage1', fields.image1);
  applyAboutSlot(fd, 'image2', 'image2AltText', 'removeImage2', fields.image2);
  await apiClient.post(`/api/v1/opportunity-listing/${listingId}/about`, fd, {
    headers: { 'Content-Type': undefined },
  });
}

function applyAboutSlot(
  fd: FormData,
  fileField: string,
  altField: string,
  removeField: string,
  item: WizardMediaItem | null,
): void {
  if (item === null) {
    fd.append(removeField, 'true');
    return;
  }
  if (item.uri !== undefined) {
    fd.append(fileField, filePart({ uri: item.uri, name: item.name, mimeType: item.mimeType }));
  }
  fd.append(altField, item.altText);
}

export async function uploadOpportunityDocument(
  opportunityId: string,
  args: { file: WizardDocItem; documentType: string; notes?: string },
): Promise<void> {
  const fd = new FormData();
  fd.append('file', filePart(args.file));
  fd.append('documentType', args.documentType);
  if (args.notes !== undefined && args.notes !== '') fd.append('notes', args.notes);
  await apiClient.post(`/api/v1/opportunities/${opportunityId}/documents`, fd, {
    headers: { 'Content-Type': undefined },
  });
}

interface OpportunityListingMediaResponse {
  media?: {
    hero?: ServerMediaItem[];
    'about-image-1'?: ServerMediaItem[];
    'about-image-2'?: ServerMediaItem[];
  };
}

export async function getOpportunityListingMedia(listingId: string): Promise<ListingMedia> {
  const { data } = await apiClient.get<OpportunityListingMediaResponse>(
    `/api/v1/opportunity-listing/${listingId}`,
  );
  const hero = (data.media?.hero ?? []).map((m, i) => mapServerMedia(m, i));
  const about1 =
    (data.media?.['about-image-1'] ?? []).map((m, i) => mapServerMedia(m, i))[0] ?? null;
  const about2 =
    (data.media?.['about-image-2'] ?? []).map((m, i) => mapServerMedia(m, i))[0] ?? null;
  return { hero, about1, about2 };
}

// --- Primary (listing-cms) ------------------------------------------------

export async function upsertPrimaryListingHeroMedia(
  listingId: string,
  fields: HeroMediaFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('mainTitle', fields.title);
  fd.append('subTitle', '');
  fd.append('description', fields.description);
  fd.append('videoLink', fields.videoLink);
  fd.append('view360Link', fields.view360Link);
  const sorted = sortHeroFirst(fields.media);
  const existing = sorted
    .filter((m) => m.id !== undefined)
    .map((m, i) => ({ id: m.id, altText: m.altText, sortOrder: i }));
  fd.append('existingMedia', JSON.stringify(existing));
  sorted.forEach((m, index) => {
    fd.append(`heroMediaAltText_${String(index)}`, m.altText);
    if (m.id === undefined && m.uri !== undefined) {
      fd.append(
        `media_${String(index)}`,
        filePart({ uri: m.uri, name: m.name, mimeType: m.mimeType }),
      );
    }
  });
  const heroIndex = sorted.findIndex((m) => m.isHero);
  if (heroIndex >= 0) fd.append('heroIndex', String(heroIndex));
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=hero`, fd, {
    headers: { 'Content-Type': undefined, 'X-Use-FormData': 'true' },
  });
}

export async function upsertPrimaryListingAbout(
  listingId: string,
  fields: AboutImageFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('mainTitle', '');
  fd.append('textSection1', '');
  fd.append('textSection2', '');
  fd.append('additionalDescription', '');
  [fields.image1, fields.image2].forEach((item, index) => {
    if (item === null) {
      fd.append(`removeAboutSlot_${String(index)}`, 'true');
      return;
    }
    fd.append(`aboutMediaAltText_${String(index)}`, item.altText);
    if (item.uri !== undefined) {
      fd.append(
        `media_${String(index)}`,
        filePart({ uri: item.uri, name: item.name, mimeType: item.mimeType }),
      );
    }
  });
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=about`, fd, {
    headers: { 'Content-Type': undefined, 'X-Use-FormData': 'true' },
  });
}

interface PrimaryCmsMediaResponse {
  sections?: {
    hero?: { media?: ServerMediaItem[] };
    about?: { media?: ServerMediaItem[] };
  };
}

export async function getPrimaryListingMedia(listingId: string): Promise<ListingMedia> {
  const { data } = await apiClient.get<PrimaryCmsMediaResponse>(`/api/v1/listing-cms/${listingId}`);
  const hero = (data.sections?.hero?.media ?? []).map((m, i) => mapServerMedia(m, i));
  const aboutMedia = (data.sections?.about?.media ?? []).map((m, i) => mapServerMedia(m, i));
  return { hero, about1: aboutMedia[0] ?? null, about2: aboutMedia[1] ?? null };
}

/** Upload one supporting document as GENERAL_DOCUMENT (secondary Media step). */
export async function upsertOpportunityListingDocuments(
  opportunityId: string,
  file: WizardDocItem,
  notes: string,
): Promise<void> {
  await uploadOpportunityDocument(opportunityId, {
    file,
    documentType: 'GENERAL_DOCUMENT',
    notes: notes === '' ? undefined : notes,
  });
}

// ---------------------------------------------------------------------------
// Identity Verification (Manual Review) — lead-scoped owner documents.
// EMIRATES_ID doc: upload + verify (VERIFIED/REJECTED) + notes. Live flow.
// ---------------------------------------------------------------------------

export type DocVerifyStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface IdentityDoc {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
}

interface RawLeadDoc {
  id: string;
  fileName?: string | null;
  name?: string | null;
  fileUrl?: string | null;
  url?: string | null;
  mimeType?: string | null;
  mimetype?: string | null;
}

function mapIdentityDoc(d: RawLeadDoc): IdentityDoc {
  return {
    id: d.id,
    fileName: d.fileName ?? d.name ?? 'document',
    fileUrl: d.fileUrl ?? d.url ?? '',
    mimeType: d.mimeType ?? d.mimetype ?? '',
  };
}

/** Upload an EMIRATES_ID identity document to the owner (lead). Returns the created doc. */
export async function uploadLeadDocument(
  leadId: string,
  file: WizardDocItem,
  notes?: string,
): Promise<IdentityDoc> {
  const fd = new FormData();
  fd.append('file', filePart(file));
  fd.append('documentType', 'EMIRATES_ID');
  if (notes !== undefined && notes !== '') fd.append('notes', notes);
  const { data } = await apiClient.post<RawLeadDoc>(`/api/v1/leads/${leadId}/documents`, fd, {
    headers: { 'Content-Type': undefined },
  });
  return mapIdentityDoc(data);
}

/** Set the verification status of an owner document. */
export async function verifyLeadDocument(
  leadId: string,
  documentId: string,
  status: DocVerifyStatus,
): Promise<void> {
  await apiClient.patch(`/api/v1/leads/${leadId}/documents/${documentId}/verify`, { status });
}

/** Update the internal notes on an owner document. */
export async function updateLeadDocumentNotes(
  leadId: string,
  documentId: string,
  notes: string,
): Promise<void> {
  const fd = new FormData();
  fd.append('notes', notes);
  await apiClient.patch(`/api/v1/leads/${leadId}/documents/${documentId}`, fd, {
    headers: { 'Content-Type': undefined },
  });
}

// ---------------------------------------------------------------------------
// Identity Verification — Send Verification Link (lead-scoped). Generate/share
// the provider link + list docs for hydration of verified/pending state.
// ---------------------------------------------------------------------------

export type VerificationProvider = 'ENTRUST' | 'UAEPASS';
export type VerificationMethod = 'LINK' | 'MANUAL';

export interface VerificationDetail {
  workflowRunId?: string;
  applicantId?: string;
  fullName?: string | null;
  documentType?: string | null;
  issuingCountry?: string | null;
  dateOfBirth?: string | null;
  breakdown?: string[];
}

export interface LeadDocument {
  id: string;
  documentType: string;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  notes: string | null;
  verificationStatus: DocVerifyStatus;
  verificationMethod: VerificationMethod | null;
  verifiedAt: string | null;
  verifiedBy: { firstName: string; lastName: string } | null;
  verificationDetail: VerificationDetail | null;
  createdAt: string;
}

function readStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function mapLeadDocument(raw: unknown): LeadDocument {
  const d = (raw ?? {}) as Record<string, unknown>;
  const s = d.verificationStatus;
  const verificationStatus: DocVerifyStatus = s === 'VERIFIED' || s === 'REJECTED' ? s : 'PENDING';
  const m = d.verificationMethod;
  const verificationMethod: VerificationMethod | null = m === 'LINK' || m === 'MANUAL' ? m : null;
  const vb = d.verifiedBy as Record<string, unknown> | null | undefined;
  const detail = d.verificationDetail as VerificationDetail | null | undefined;
  return {
    id: String(d.id ?? ''),
    documentType: String(d.documentType ?? ''),
    fileUrl: readStr(d.fileUrl) ?? '',
    fileName: readStr(d.fileName) ?? 'document',
    fileSize: typeof d.fileSize === 'number' ? d.fileSize : null,
    mimeType: readStr(d.mimeType),
    notes: readStr(d.notes),
    verificationStatus,
    verificationMethod,
    verifiedAt: readStr(d.verifiedAt),
    verifiedBy:
      vb && typeof vb === 'object'
        ? { firstName: String(vb.firstName ?? ''), lastName: String(vb.lastName ?? '') }
        : null,
    verificationDetail: detail && typeof detail === 'object' ? detail : null,
    createdAt: readStr(d.createdAt) ?? '',
  };
}

/** List the owner's documents (for hydrating identity verification state). */
export async function getLeadDocuments(leadId: string): Promise<LeadDocument[]> {
  const { data } = await apiClient.get<unknown[]>(`/api/v1/leads/${leadId}/documents`);
  return (Array.isArray(data) ? data : []).map(mapLeadDocument);
}

/** Generate (or, with reset, regenerate) a provider verification link for the owner. */
export async function generateLeadVerificationLink(
  leadId: string,
  provider: VerificationProvider,
  reset?: boolean,
): Promise<{ id: string; url: string }> {
  const { data } = await apiClient.post<{ id: string; url: string }>(
    `/api/v1/leads/${leadId}/identity-verification/link`,
    { provider, reset },
  );
  return { id: data.id, url: data.url };
}

/** Record that the verification link was shared via WhatsApp or Email (activity timeline). */
export async function shareLeadVerificationLink(
  leadId: string,
  linkId: string,
  mode: 'WHATSAPP' | 'EMAIL',
): Promise<void> {
  await apiClient.post(`/api/v1/leads/${leadId}/identity-verification/link/${linkId}/share`, {
    mode,
  });
}

// ---------------------------------------------------------------------------
// Amenities (Portals step) — master catalog + per-branch selection save.
// ---------------------------------------------------------------------------

export interface MasterAmenity {
  id: string;
  name: string;
  description: string;
  slug: string;
  icon: string | null;
  iconUrl: string | null;
  isPfAmenity: boolean;
}

function mapMasterAmenity(raw: unknown): MasterAmenity {
  const a = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(a.id ?? ''),
    name: typeof a.name === 'string' ? a.name : '',
    description: typeof a.description === 'string' ? a.description : '',
    slug: typeof a.slug === 'string' ? a.slug : '',
    icon: typeof a.icon === 'string' ? a.icon : null,
    iconUrl: typeof a.iconUrl === 'string' ? a.iconUrl : null,
    isPfAmenity: a.isPfAmenity === true,
  };
}

/** Master amenities catalog (for the Portals selector). */
export async function getMasterAmenities(): Promise<MasterAmenity[]> {
  const { data } = await apiClient.get<unknown[]>('/api/v1/project-public-page/amenities');
  return (Array.isArray(data) ? data : []).map(mapMasterAmenity);
}

/** Secondary branch — set the opportunity-listing's selected amenities. */
export async function upsertOpportunityListingAmenities(
  listingId: string,
  selectedAmenityIds: string[],
): Promise<void> {
  await apiClient.patch(`/api/v1/opportunity-listing/${listingId}/amenities`, {
    selectedAmenityIds,
  });
}

/** Primary branch — set the listing-cms amenities section (multipart). */
export async function upsertPrimaryListingAmenities(
  listingId: string,
  selectedAmenityIds: string[],
): Promise<void> {
  const fd = new FormData();
  fd.append(
    'amenities',
    JSON.stringify(selectedAmenityIds.map((amenityId, index) => ({ amenityId, sortOrder: index }))),
  );
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=amenities`, fd, {
    headers: { 'Content-Type': undefined, 'X-Use-FormData': 'true' },
  });
}

// ===========================================================================
// Step 4 "Portals" — website-content sections, Trakheesi permit, wizard-state,
// blob upload, Property Finder agents. Mirrors the boh-lead-magnet wizard save
// wiring (useListingWizard.finish → savePrimarySections / saveAllSections +
// savePermit + persistResumeState). Secondary uses per-section endpoints;
// primary uses the single `/listing-cms?section=` upsert.
// ===========================================================================

const CMS_FORMDATA_HEADERS = { 'Content-Type': undefined, 'X-Use-FormData': 'true' } as const;
const MULTIPART_HEADERS = { 'Content-Type': undefined } as const;

export interface HeroContentFields {
  title: string;
  subtitle: string;
  description: string;
  videoLink: string;
  view360Link: string;
  media: WizardMediaItem[];
}

/** existingMedia payload — id-carrying items (re-seeded after the media step) preserved in order. */
function existingMediaJson(media: WizardMediaItem[]): string {
  const sorted = sortHeroFirst(media);
  return JSON.stringify(
    sorted
      .filter((m) => m.id !== undefined)
      .map((m, i) => ({ id: m.id, altText: m.altText, sortOrder: i })),
  );
}

// --- Hero subtitle (re-save carrying title/description/media so nothing is clobbered) ---------

export async function upsertOpportunityListingHeroContent(
  listingId: string,
  fields: HeroContentFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('title', fields.title);
  fd.append('subtitle', fields.subtitle);
  fd.append('description', fields.description);
  fd.append('videoLink', fields.videoLink);
  fd.append('view360Link', fields.view360Link);
  fd.append('existingMedia', existingMediaJson(fields.media));
  fd.append('newMediaAltTexts', '[]');
  await apiClient.post(`/api/v1/opportunity-listing/${listingId}/hero`, fd, {
    headers: MULTIPART_HEADERS,
  });
}

export async function upsertPrimaryListingHeroContent(
  listingId: string,
  fields: HeroContentFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('mainTitle', fields.title);
  fd.append('subTitle', fields.subtitle);
  fd.append('description', fields.description);
  fd.append('videoLink', fields.videoLink);
  fd.append('view360Link', fields.view360Link);
  fd.append('existingMedia', existingMediaJson(fields.media));
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=hero`, fd, {
    headers: CMS_FORMDATA_HEADERS,
  });
}

// --- About text (text-only; image slots left untouched so media-step uploads survive) ---------

export interface AboutTextFields {
  title: string;
  subtitle: string;
  textSection1: string;
  textSection2: string;
  additionalDescription: string;
}

export async function upsertOpportunityListingAboutText(
  listingId: string,
  fields: AboutTextFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('title', fields.title);
  fd.append('subtitle', fields.subtitle);
  fd.append('textSection1', fields.textSection1);
  fd.append('textSection2', fields.textSection2);
  fd.append('additionalDescription', fields.additionalDescription);
  await apiClient.post(`/api/v1/opportunity-listing/${listingId}/about`, fd, {
    headers: MULTIPART_HEADERS,
  });
}

export async function upsertPrimaryListingAboutText(
  listingId: string,
  fields: AboutTextFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('mainTitle', fields.title);
  fd.append('subtitle', fields.subtitle);
  fd.append('textSection1', fields.textSection1);
  fd.append('textSection2', fields.textSection2);
  fd.append('additionalDescription', fields.additionalDescription);
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=about`, fd, {
    headers: CMS_FORMDATA_HEADERS,
  });
}

// --- Highlights (title + subtitle; optional brochure URL) -------------------------------------

export interface HighlightsFields {
  title: string;
  subtitle: string;
  brochureUrl?: string;
}

export async function upsertOpportunityListingHighlights(
  listingId: string,
  fields: HighlightsFields,
): Promise<void> {
  await apiClient.patch(`/api/v1/opportunity-listing/${listingId}/highlights`, {
    title: fields.title,
    subtitle: fields.subtitle,
    ...(fields.brochureUrl !== undefined ? { brochureUrl: fields.brochureUrl } : {}),
  });
}

export async function upsertPrimaryListingHighlights(
  listingId: string,
  fields: HighlightsFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('title', fields.title);
  fd.append('subtitle', fields.subtitle);
  if (fields.brochureUrl !== undefined) fd.append('brochureUrl', fields.brochureUrl);
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=highlights`, fd, {
    headers: CMS_FORMDATA_HEADERS,
  });
}

// --- Location & Connectivity ------------------------------------------------------------------

export interface LocationFields {
  heading: string;
  subtitle: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
}

export async function upsertOpportunityListingLocation(
  listingId: string,
  fields: LocationFields,
): Promise<void> {
  await apiClient.patch(`/api/v1/opportunity-listing/${listingId}/location`, {
    title: fields.heading,
    subtitle: fields.subtitle,
    locationName: fields.locationName,
    ...(fields.latitude !== null ? { latitude: fields.latitude } : {}),
    ...(fields.longitude !== null ? { longitude: fields.longitude } : {}),
    categoryTabs: [],
  });
}

export async function upsertPrimaryListingLocation(
  listingId: string,
  fields: LocationFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('title', fields.heading);
  fd.append('subtitle', fields.subtitle);
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=location`, fd, {
    headers: CMS_FORMDATA_HEADERS,
  });
}

// --- SEO --------------------------------------------------------------------------------------

export interface SeoFields {
  metaTitle: string;
  urlSlug: string;
  metaDescription: string;
}

export async function upsertOpportunityListingSeo(
  listingId: string,
  fields: SeoFields,
): Promise<void> {
  const fd = new FormData();
  fd.append('metaTitle', fields.metaTitle);
  fd.append('metaDescription', fields.metaDescription);
  fd.append('urlSlug', fields.urlSlug);
  await apiClient.post(`/api/v1/opportunity-listing/${listingId}/seo`, fd, {
    headers: MULTIPART_HEADERS,
  });
}

export async function upsertPrimaryListingSeo(listingId: string, fields: SeoFields): Promise<void> {
  const fd = new FormData();
  fd.append('metaTitle', fields.metaTitle);
  fd.append('urlSlug', fields.urlSlug);
  fd.append('metaDescription', fields.metaDescription);
  await apiClient.post(`/api/v1/listing-cms/${listingId}?section=seo-settings`, fd, {
    headers: CMS_FORMDATA_HEADERS,
  });
}

// --- Blob upload (QR code / brochure) ---------------------------------------------------------

interface StorageUploadTarget {
  uploadUrl: string;
  publicUrl: string;
}

/** Ask the backend for a pre-signed Azure blob URL, then PUT the file to it; returns publicUrl. */
export async function uploadToBlobStorage(
  item: { uri: string; name: string; mimeType: string },
  folder: string,
): Promise<string> {
  const { data } = await apiClient.post<StorageUploadTarget>('/api/v1/storage/upload-url', {
    filename: item.name,
    mimeType: item.mimeType,
    folder,
  });
  const blob = await (await fetch(item.uri)).blob();
  await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': item.mimeType },
    body: blob,
  });
  return data.publicUrl;
}

// --- Trakheesi permit -------------------------------------------------------------------------

export interface PermitFields {
  status: string;
  permitNumber: string;
  permitUrl: string;
  applicationDate: string;
  expiryDate: string;
  /** Already-uploaded QR public URL (from uploadToBlobStorage); omitted when none. */
  qrCodeUrl?: string;
  qrCodeAltText: string;
  complete: boolean;
}

/** JSON body mirroring the web `buildPermitBody`: incomplete → not_applied; complete → approved. */
function buildPermitBody(fields: PermitFields): Record<string, unknown> {
  if (!fields.complete) {
    return {
      status: 'not_applied',
      ...(fields.permitNumber !== '' ? { permitNumber: fields.permitNumber } : {}),
      ...(fields.applicationDate !== '' ? { applicationDate: fields.applicationDate } : {}),
      ...(fields.permitUrl !== '' ? { permitDocumentUrl: fields.permitUrl } : {}),
    };
  }
  return {
    status: 'approved',
    permitNumber: fields.permitNumber,
    applicationDate: fields.applicationDate,
    approvalDate: fields.applicationDate,
    expiryDate: fields.expiryDate,
    qrCodeAltText: fields.qrCodeAltText,
    ...(fields.permitUrl !== '' ? { permitDocumentUrl: fields.permitUrl } : {}),
    ...(fields.qrCodeUrl !== undefined ? { qrCodeUrl: fields.qrCodeUrl } : {}),
  };
}

/** Full Trakheesi permit (with application/approval dates) for edit prefill. */
export async function getOpportunityListingPermit(
  listingId: string,
): Promise<EditPermitRaw | null> {
  const { data } = await apiClient.get<EditPermitRaw>(
    `/api/v1/opportunity-listing/${listingId}/trakheesi-permit`,
  );
  return data ?? null;
}

export async function getPrimaryListingPermit(listingId: string): Promise<EditPermitRaw | null> {
  const { data } = await apiClient.get<EditPermitRaw>(
    `/api/v1/listing-cms/${listingId}/trakheesi-permit`,
  );
  return data ?? null;
}

export async function upsertOpportunityListingPermit(
  listingId: string,
  fields: PermitFields,
): Promise<void> {
  await apiClient.patch(
    `/api/v1/opportunity-listing/${listingId}/trakheesi-permit`,
    buildPermitBody(fields),
  );
}

export async function upsertPrimaryListingPermit(
  listingId: string,
  fields: PermitFields,
): Promise<void> {
  await apiClient.patch(
    `/api/v1/listing-cms/${listingId}/trakheesi-permit`,
    buildPermitBody(fields),
  );
}

// --- Wizard-state (persists portal toggles + PF fields) ---------------------------------------

export interface WizardStatePortals {
  publishToPortal: boolean;
  pushToPropertyFinder: boolean;
  pfAgentId: number | null;
  pfLocationId: number | null;
  pfPriceHidden: boolean;
  pfPublishAsDraft: boolean;
}

export async function persistOpportunityWizardState(
  listingId: string,
  portals: WizardStatePortals,
): Promise<void> {
  await apiClient.patch(`/api/v1/opportunity-listing/${listingId}/wizard-state`, {
    step: 4,
    publish: { publishToPortal: portals.publishToPortal },
    pfAgentId: portals.pfAgentId,
    pfLocationId: portals.pfLocationId,
    pfPriceHidden: portals.pfPriceHidden,
    pfPublishAsDraft: portals.pfPublishAsDraft,
    ...(portals.pushToPropertyFinder ? { pushToPropertyFinder: true } : {}),
  });
}

export async function persistPrimaryWizardState(
  listingId: string,
  portals: WizardStatePortals,
): Promise<void> {
  await apiClient.patch(`/api/v1/listings/${listingId}/wizard-state`, {
    step: 4,
    pfLocationId: portals.pfLocationId,
    pfPublishAsDraft: portals.pfPublishAsDraft,
  });
}

// --- Portal settings (admin on/off switches; gates the PF portal row) --------------------------

export type PortalKey = 'property_finder' | 'bayut' | 'dubizzle';

export interface PortalSetting {
  portal: PortalKey;
  enabled: boolean;
  locked: boolean;
}

export async function getPortalSettings(): Promise<PortalSetting[]> {
  const { data } = await apiClient.get<PortalSetting[]>('/api/v1/portal-settings');
  return Array.isArray(data) ? data : [];
}

// --- Property Finder agents (dropdown on the PF config block) ---------------------------------

export async function getPropertyFinderAgents(): Promise<Opt[]> {
  const { data } = await apiClient.get<unknown>('/api/v1/property-finder/users');
  const rows = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown[] } | null)?.items)
      ? (data as { items: unknown[] }).items
      : [];
  return rows.map((raw) => {
    const a = (raw ?? {}) as Record<string, unknown>;
    return { value: String(a.id ?? ''), label: typeof a.name === 'string' ? a.name : 'Agent' };
  });
}
