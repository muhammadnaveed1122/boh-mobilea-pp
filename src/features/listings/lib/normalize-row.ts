import type {
  ListingListItem,
  ListingPortal,
  PriceTrend,
  PrimaryListingItem,
  UnifiedListingRow,
} from '../types';

function normalizeTrend(trend: PriceTrend | undefined): PriceTrend {
  return trend ?? 'none';
}

function pfPortals(pushed: boolean | undefined, pfId: string | null | undefined): ListingPortal[] {
  const portals: ListingPortal[] = [];
  if (pushed === true || (pfId ?? '') !== '') portals.push('property_finder');
  return portals;
}

function fullName(
  assignee: { firstName?: string | null; lastName?: string | null } | null | undefined,
): string | null {
  if (!assignee) return null;
  const name = `${assignee.firstName ?? ''} ${assignee.lastName ?? ''}`.trim();
  return name === '' ? null : name;
}

export function normalizePrimaryRow(item: PrimaryListingItem): UnifiedListingRow {
  const projectName = item.project?.projectName ?? item.projectName ?? null;
  const trimmedTitle = (item.title ?? '').trim();
  return {
    id: item.id,
    kind: 'primary',
    title: trimmedTitle === '' ? 'Untitled listing' : trimmedTitle,
    status: item.status,
    isPublished: item.isPublished ?? null,
    price: item.price ?? null,
    previousPrice: item.previousPrice ?? null,
    priceTrend: normalizeTrend(item.priceTrend),
    stage: item.stage ?? null,
    projectName,
    developerName: item.developerName ?? null,
    propertyLabel: projectName,
    permitNumber: null,
    propertyType: item.propertyType ?? item.unitType?.propertyType ?? null,
    bedrooms: item.bedrooms ?? item.unitType?.bedrooms ?? null,
    bathrooms: item.bathrooms ?? item.unitType?.bathrooms ?? null,
    sizeSqft: item.sizeSqft ?? item.unitType?.sizeMin ?? item.unitType?.sizeMax ?? null,
    unitNumber: item.unitNumber ?? null,
    location: item.neighbourhoodName ?? projectName,
    heroImageUrl: item.heroImageUrls?.[0] ?? null,
    agentName: fullName(item.assignee),
    createdByName: item.createdByName ?? null,
    assigneeId: item.assigneeId ?? null,
    portals: pfPortals(item.isPushedToPropertyFinder, item.pfListingId),
    purpose: item.purpose ?? null,
    updatedAt: item.updatedAt ?? null,
    leadId: null,
    opportunityId: null,
    slug: item.slug ?? item.project?.slug ?? null,
  };
}

export function normalizeSecondaryRow(item: ListingListItem): UnifiedListingRow {
  const trimmedHeroTitle = (item.heroTitle ?? '').trim();
  const trimmedName = (item.name ?? '').trim();
  const title = trimmedHeroTitle || trimmedName || 'Untitled listing';
  return {
    id: item.id,
    kind: 'secondary',
    title,
    status: item.status,
    isPublished: item.isPublished,
    price: item.price ?? null,
    previousPrice: item.previousPrice ?? null,
    priceTrend: normalizeTrend(item.priceTrend),
    stage: item.stage ?? null,
    projectName: null,
    developerName: null,
    propertyLabel: item.propertyLabel ?? null,
    permitNumber: item.permitNumber ?? null,
    propertyType: item.propertyType ?? null,
    bedrooms: item.bedrooms ?? null,
    bathrooms: item.bathrooms ?? null,
    sizeSqft: null,
    unitNumber: item.unitNumber ?? null,
    location: item.neighbourhoodName ?? item.stateName ?? null,
    heroImageUrl: item.heroImageUrl ?? null,
    agentName: fullName(item.assignee) ?? item.agentName ?? null,
    createdByName: item.createdByName ?? null,
    assigneeId: item.assigneeId ?? null,
    portals: pfPortals(item.isPushedToPropertyFinder, item.pfListingId),
    purpose: item.purpose ?? null,
    updatedAt: item.updatedAt,
    leadId: item.leadId ?? null,
    opportunityId: item.opportunityId ?? null,
    slug: item.urlSlug ?? null,
  };
}
