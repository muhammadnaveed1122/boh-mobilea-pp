/**
 * Project-management data access. Same NestJS endpoints the web app uses:
 *   GET /api/v1/projects?id=<id>            (single project, returned as items[0])
 *   GET /api/v1/projects/payment-plans      (paginated)
 *   GET /api/v1/projects/segments           (paginated)
 *   GET /api/v1/projects/unit-types         (paginated, layouts nested)
 * The shared apiClient interceptor unwraps the {success,data} envelope.
 */
import { apiClient } from '@/lib/api';
import { filterVisibleAmenities } from '@/lib/amenities';

import type {
  PaymentPlan,
  PaymentPlanMilestone,
  PermitDocument,
  Project,
  ProjectDeveloper,
  ProjectOperationsManager,
  Segment,
  UnitLayout,
  UnitType,
} from './models';
import type { AreaListingItem, AreaListingsPage } from '@/features/areas/models/area-detail';
import type { AreaOption } from '@/features/areas/components/AreaOptionSheet';

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function toDeveloper(raw: unknown): ProjectDeveloper | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  return { id: r.id, brandName: str(r.brandName) ?? '—', logoUrl: str(r.logoUrl) };
}

function toOpsManager(raw: unknown): ProjectOperationsManager | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  return { id: r.id, name: str(r.name), email: str(r.email) ?? '' };
}

function toPermitDoc(raw: unknown): PermitDocument | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    documentName: str(r.documentName) ?? 'Document',
    documentUrl: str(r.documentUrl) ?? '',
    createdAt: str(r.createdAt) ?? '',
  };
}

function toProject(raw: unknown): Project | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  const heroMany = arr(r.heroImageUrls).filter((u): u is string => typeof u === 'string');
  const heroOne = str(r.heroImageUrl);
  return {
    id: r.id,
    projectName: str(r.projectName) ?? '—',
    developer: toDeveloper(r.developer),
    operationsManager: toOpsManager(r.operationsManager),
    availability: str(r.availability),
    status: str(r.status),
    trakheesiPermitStatus: str(r.trakheesiPermitStatus),
    trakheesiQrCodeUrl: str(r.trakheesiQrCodeUrl),
    developmentStage: str(r.developmentStage),
    neighbourhoodName: str(r.neighbourhoodName) ?? str(r.neighborhood),
    stateName: str(r.stateName) ?? str(r.city),
    propertyUse: str(r.propertyUse),
    handoverDate: str(r.handoverDate),
    lifestyleStandard: str(r.lifestyleStandard),
    shortDescription: str(r.shortDescription),
    heroImageUrls: heroMany.length > 0 ? heroMany : heroOne ? [heroOne] : [],
    reraProjectNumber: str(r.reraProjectNumber),
    dldPermitReference: str(r.dldPermitReference),
    dldPermitStatus: str(r.dldPermitStatus),
    permitDocuments: arr(r.permitDocuments)
      .map(toPermitDoc)
      .filter((d): d is PermitDocument => d !== null),
    commissionModel: str(r.commissionModel),
    defaultCommissionPercent: num(r.defaultCommissionPercent),
    reservationFee: num(r.reservationFee),
    startingPrice: num(r.startingPrice),
    updatedAt: str(r.updatedAt) ?? '',
  };
}

function toMilestone(raw: unknown): PaymentPlanMilestone {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(r.id) ?? `${str(r.name) ?? 'm'}-${num(r.displayOrder) ?? 0}`,
    name: str(r.name) ?? '—',
    percentage: num(r.percentage) ?? 0,
    amount: num(r.amount),
    date: str(r.date),
    displayOrder: num(r.displayOrder) ?? 0,
  };
}

function toPaymentPlan(raw: unknown): PaymentPlan | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    planName: str(r.planName) ?? '—',
    status: r.status === 'active' ? 'active' : 'draft',
    totalPercentage: num(r.totalPercentage) ?? 0,
    milestones: arr(r.milestones)
      .map(toMilestone)
      .sort((a, b) => a.displayOrder - b.displayOrder),
  };
}

function toSegment(raw: unknown): Segment | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    name: str(r.name) ?? '—',
    viewType: str(r.viewType),
    floorsMin: num(r.floorsMin) ?? 0,
    floorsMax: num(r.floorsMax) ?? 0,
    completionStage: str(r.completionStage),
    expectedHandover: str(r.expectedHandover),
    status: str(r.status) ?? 'inactive',
  };
}

function toLayout(raw: unknown): UnitLayout | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    name: str(r.name) ?? '—',
    viewType: str(r.viewType),
    size: num(r.size),
    price: num(r.price),
    currency: str(r.currency),
    previewImageUrl: str(r.previewImageUrl),
    previewImageAltText: str(r.previewImageAltText) ?? str(r.previewImageAlt),
    floorPlanPdfUrl: str(r.floorPlanPdfUrl),
  };
}

function toUnitType(raw: unknown): UnitType | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  return {
    id: r.id,
    segmentName: str(r.segmentName) ?? '—',
    propertyUse: str(r.propertyUse),
    propertyType: str(r.propertyType),
    unitType: str(r.unitType) ?? '',
    bedrooms: num(r.bedrooms),
    bathrooms: num(r.bathrooms),
    sizeMin: num(r.sizeMin),
    sizeMax: num(r.sizeMax),
    priceMin: num(r.priceMin),
    priceMax: num(r.priceMax),
    currency: str(r.currency),
    layouts: arr(r.layouts)
      .map(toLayout)
      .filter((l): l is UnitLayout => l !== null),
  };
}

function itemsOf(data: unknown): unknown[] {
  return arr((data as { items?: unknown[] } | null)?.items);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const { data } = await apiClient.get('/api/v1/projects', { params: { id } });
  const items = itemsOf(data);
  return items.length > 0 ? toProject(items[0]) : null;
}

export async function getProjectPaymentPlans(projectId: string): Promise<PaymentPlan[]> {
  const { data } = await apiClient.get('/api/v1/projects/payment-plans', {
    params: { projectId, page: 1, limit: 100, includeDeleted: false },
  });
  return itemsOf(data)
    .map(toPaymentPlan)
    .filter((p): p is PaymentPlan => p !== null);
}

export async function getProjectSegments(projectId: string): Promise<Segment[]> {
  const { data } = await apiClient.get('/api/v1/projects/segments', {
    params: {
      projectId,
      page: 1,
      limit: 100,
      includeDeleted: false,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
  });
  return itemsOf(data)
    .map(toSegment)
    .filter((s): s is Segment => s !== null);
}

export async function getProjectUnitTypes(projectId: string): Promise<UnitType[]> {
  const { data } = await apiClient.get('/api/v1/projects/unit-types', {
    params: { projectId, page: 1, limit: 100, includeDeleted: false, sortOrder: 'desc' },
  });
  return itemsOf(data)
    .map(toUnitType)
    .filter((u): u is UnitType => u !== null);
}

// ─── Project listing (top-level read-only list) ──────────────────────────────

const LIST_LIMIT = 12;

export interface ProjectListFilters {
  readonly search?: string;
  readonly status?: string;
  readonly availability?: string;
  readonly stateId?: string;
  readonly developerId?: string;
}

/** GET /api/v1/projects row → rich card shape (with project-listing badge extras). */
function toListingItem(raw: unknown): AreaListingItem | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string') return null;
  const heroMany = arr(r.heroImageUrls).filter((u): u is string => typeof u === 'string');
  const heroOne = str(r.heroImageUrl);
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
    imageUrls: heroMany.length > 0 ? heroMany : heroOne ? [heroOne] : [],
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
    status: str(r.status) ?? undefined,
    availabilityType: str(r.availability) ?? undefined,
    trakheesiPermit: str(r.trakheesiPermitStatus) ?? undefined,
    trakheesiQrCodeUrl: str(r.trakheesiQrCodeUrl),
  };
}

interface ListEnvelope {
  items?: unknown[];
  total?: number;
  totalPages?: number;
  page?: number;
}

export async function getProjectsPage(
  filters: ProjectListFilters,
  page: number,
): Promise<AreaListingsPage> {
  const { search, status, availability, stateId, developerId } = filters;
  const { data } = await apiClient.get('/api/v1/projects', {
    params: {
      page,
      limit: LIST_LIMIT,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(availability ? { availability } : {}),
      ...(stateId ? { stateId } : {}),
      ...(developerId ? { developerId } : {}),
    },
  });
  const body = (data ?? {}) as ListEnvelope;
  return {
    items: (body.items ?? []).map(toListingItem).filter((x): x is AreaListingItem => x !== null),
    page: Number(body.page ?? page),
    totalPages: Number(body.totalPages ?? 1),
    total: Number(body.total ?? 0),
  };
}

/** GET /api/v1/developers — options for the Developer filter (id → brandName). */
export async function getDevelopers(search?: string): Promise<AreaOption[]> {
  const { data } = await apiClient.get('/api/v1/developers', {
    params: {
      page: 1,
      limit: 100,
      sortBy: 'brandName',
      sortOrder: 'asc',
      ...(search ? { search } : {}),
    },
  });
  const rows = itemsOf(data) as Record<string, unknown>[];
  return rows
    .filter((r) => typeof r.id === 'string')
    .map((r) => ({ value: r.id as string, label: str(r.brandName) ?? '—' }));
}

// ─── Project comparison ──────────────────────────────────────────────────────

/** GET /api/v1/projects/{id}/public-page → visible amenity names. */
export async function getProjectAmenities(id: string): Promise<string[]> {
  try {
    const { data } = await apiClient.get(`/api/v1/projects/${id}/public-page`);
    const sections = (data as { sections?: Record<string, unknown> } | null)?.sections ?? {};
    const amenities = (sections.amenities ?? {}) as { items?: unknown[] };
    return filterVisibleAmenities(arr(amenities.items) as { isVisible?: boolean | null }[])
      .map((a) => str((a as Record<string, unknown>).name))
      .filter((n): n is string => n !== null);
  } catch {
    return [];
  }
}

export interface CompareProjectPaymentPlan {
  readonly name: string;
  readonly status: string;
  readonly milestones: { label: string; percent: number }[];
}

export interface CompareFloorPlan {
  readonly label: string;
  readonly previewImageUrl: string | null;
  readonly pdfUrl: string | null;
}

export interface CompareProject {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly startingPrice: number | null;
  readonly bookingFee: number | null;
  readonly availability: string | null;
  readonly developmentStage: string | null;
  readonly handoverDate: string | null;
  readonly location: string;
  readonly developer: string;
  readonly lifestyleTier: string | null;
  readonly propertyUse: string | null;
  readonly unitTypes: string[];
  readonly floorPlans: CompareFloorPlan[];
  readonly amenities: string[];
  readonly paymentPlans: CompareProjectPaymentPlan[];
}

/** Hydrate one project's full comparison dataset across the relevant endpoints. */
export async function getCompareProject(id: string): Promise<CompareProject | null> {
  const [project, unitTypes, paymentPlans, amenities] = await Promise.all([
    getProjectById(id),
    getProjectUnitTypes(id),
    getProjectPaymentPlans(id),
    getProjectAmenities(id),
  ]);
  if (!project) return null;
  const unitTypeLabels = Array.from(new Set(unitTypes.map((u) => u.unitType).filter(Boolean)));
  const floorPlans: CompareFloorPlan[] = unitTypes.flatMap((u) =>
    u.layouts.map((l) => ({
      label: l.name,
      previewImageUrl: l.previewImageUrl,
      pdfUrl: l.floorPlanPdfUrl,
    })),
  );
  return {
    id: project.id,
    name: project.projectName,
    imageUrl: project.heroImageUrls[0] ?? null,
    startingPrice: project.startingPrice,
    bookingFee: project.reservationFee,
    availability: project.availability,
    developmentStage: project.developmentStage,
    handoverDate: project.handoverDate,
    location: project.stateName ?? '',
    developer: project.developer?.brandName ?? '—',
    lifestyleTier: project.lifestyleStandard,
    propertyUse: project.propertyUse,
    unitTypes: unitTypeLabels,
    floorPlans,
    amenities,
    paymentPlans: paymentPlans.map((plan) => ({
      name: plan.planName,
      status: plan.status,
      milestones: plan.milestones.map((m) => ({ label: m.name, percent: m.percentage })),
    })),
  };
}
