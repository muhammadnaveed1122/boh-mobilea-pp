/**
 * Map the primary (project) CMS payload (`GET /listing-cms/:id`) into the shared
 * `ListingDetail` shape so the same `ListingDetailScreen` renders both branches.
 * Primary-only facts (developer, project, availability, specs) go on the
 * `primary` block, surfaced by the Project Details card.
 */

import type {
  ListingAmenity,
  ListingDetail,
  ListingMediaItem,
  ListingStatus,
  ListingTrakheesiPermit,
  TrakheesiPermitStatus,
} from '../types';

interface CmsMedia {
  id: string;
  mediaUrl: string;
  mediaType: string;
  originalName?: string | null;
  altText?: string | null;
  sortOrder: number;
}

interface CmsAmenityItem {
  id: string;
  amenityId: string;
  name: string;
  slug?: string | null;
  icon?: string | null;
  isCustom?: boolean;
  sortOrder?: number;
}

interface CmsSections {
  hero?: { mainTitle?: string | null; subTitle?: string | null; media?: CmsMedia[] } | null;
  highlights?: {
    mainHeading?: string | null;
    segmentName?: string | null;
    title?: string | null;
    subtitle?: string | null;
    price?: number | null;
    publicPrice?: number | null;
  } | null;
  about?: {
    mainTitle?: string | null;
    subTitle?: string | null;
    textSection1?: string | null;
    textSection2?: string | null;
    additionalDescription?: string | null;
    media?: CmsMedia[];
  } | null;
  amenities?: { items?: CmsAmenityItem[] } | null;
  location?: {
    title?: string | null;
    tagline?: string | null;
    mapCenter?: { latitude: number; longitude: number } | null;
  } | null;
  seoSettings?: {
    metaTitle?: string | null;
    urlSlug?: string | null;
    metaDescription?: string | null;
  } | null;
}

export interface PrimaryCmsDetailResponse {
  id: string;
  listingId: string;
  slug?: string | null;
  status: string;
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt: string;
  agentInfo?: { id: string; name: string; avatarUrl?: string | null; email?: string } | null;
  assigneeId?: string | null;
  purpose?: string | null;
  availability?: string | null;
  developerName?: string | null;
  projectName?: string | null;
  neighbourhoodName?: string | null;
  propertyType?: string | null;
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
  availabilityDate?: string | null;
  priceType?: string | null;
  maxCheques?: number | null;
  deposit?: string | null;
  sections: CmsSections;
  trakheesiPermit?: {
    status?: string | null;
    permitNumber?: string | null;
    qrCodeUrl?: string | null;
    qrCodeAltText?: string | null;
    expiryDate?: string | null;
  } | null;
}

const PERMIT_STATUSES: readonly TrakheesiPermitStatus[] = [
  'not_applied',
  'applied',
  'approved',
  'expired',
];

function toPermitStatus(status?: string | null): TrakheesiPermitStatus {
  return PERMIT_STATUSES.find((s) => s === status) ?? 'not_applied';
}

function mapMedia(items: CmsMedia[] | undefined, sectionKey: string): ListingMediaItem[] {
  return (items ?? []).map((m) => ({
    id: m.id,
    sectionKey,
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    originalName: m.originalName ?? null,
    altText: m.altText ?? null,
    sortOrder: m.sortOrder,
  }));
}

function mapAmenities(items: CmsAmenityItem[] | undefined): ListingAmenity[] {
  return (items ?? []).map((a) => ({
    id: a.id,
    amenityId: a.amenityId,
    sortOrder: a.sortOrder,
    amenity: { id: a.amenityId, name: a.name, slug: a.slug ?? undefined, icon: a.icon ?? null },
  }));
}

export function mapPrimaryCmsToDetail(res: PrimaryCmsDetailResponse): ListingDetail {
  const s = res.sections ?? {};
  const price = s.highlights?.publicPrice ?? s.highlights?.price ?? null;
  const permit: ListingTrakheesiPermit | null = res.trakheesiPermit
    ? {
        status: toPermitStatus(res.trakheesiPermit.status),
        permitNumber: res.trakheesiPermit.permitNumber ?? null,
        qrCodeUrl: res.trakheesiPermit.qrCodeUrl ?? null,
        qrCodeAltText: res.trakheesiPermit.qrCodeAltText ?? null,
        expiryDate: res.trakheesiPermit.expiryDate ?? null,
      }
    : null;

  return {
    id: res.listingId,
    name: res.projectName ?? s.hero?.mainTitle ?? null,
    status: res.status as ListingStatus,
    urlSlug: res.slug ?? null,
    isPublished: res.isPublished,
    publishedAt: res.publishedAt ?? null,
    createdAt: res.createdAt ?? null,
    updatedAt: res.updatedAt,
    assigneeId: res.assigneeId ?? null,
    agentInfo: res.agentInfo
      ? {
          id: res.agentInfo.id,
          name: res.agentInfo.name,
          avatarUrl: res.agentInfo.avatarUrl ?? null,
          email: res.agentInfo.email ?? null,
        }
      : null,
    sections: {
      hero: { title: s.hero?.mainTitle ?? null, subtitle: s.hero?.subTitle ?? null },
      about: {
        title: s.about?.mainTitle ?? null,
        subtitle: s.about?.subTitle ?? null,
        textSection1: s.about?.textSection1 ?? null,
        textSection2: s.about?.textSection2 ?? null,
        additionalDescription: s.about?.additionalDescription ?? null,
      },
      highlights: {
        title: s.highlights?.title ?? s.highlights?.mainHeading ?? null,
        subtitle: s.highlights?.subtitle ?? s.highlights?.segmentName ?? null,
        propertyType: res.propertyType ?? null,
        bedrooms: res.bedrooms ?? null,
        bathrooms: res.bathrooms ?? null,
        view: res.viewType ?? null,
        furnishing: res.furnishing ?? null,
        builtUpArea: res.size != null ? String(res.size) : null,
        price,
      },
      location: {
        title: s.location?.title ?? null,
        subtitle: s.location?.tagline ?? null,
        locationName: res.neighbourhoodName ?? null,
        latitude: s.location?.mapCenter?.latitude ?? null,
        longitude: s.location?.mapCenter?.longitude ?? null,
      },
      seo: {
        metaTitle: s.seoSettings?.metaTitle ?? null,
        urlSlug: s.seoSettings?.urlSlug ?? null,
        metaDescription: s.seoSettings?.metaDescription ?? null,
      },
    },
    media: { hero: mapMedia(s.hero?.media, 'hero'), about: mapMedia(s.about?.media, 'about') },
    amenities: mapAmenities(s.amenities?.items),
    derived: {
      propertyType: res.propertyType ?? null,
      bedrooms: res.bedrooms ?? null,
      bathrooms: res.bathrooms ?? null,
      view: res.viewType ?? null,
      furnishing: res.furnishing ?? null,
      builtUpArea: res.size != null ? String(res.size) : null,
      purpose:
        res.purpose === 'for_rent' ? 'for_rent' : res.purpose === 'for_sale' ? 'for_sale' : null,
      priceType: res.priceType ?? null,
      deposit: res.deposit ?? null,
      maxCheques: res.maxCheques ?? null,
    },
    trakheesiPermit: permit,
    primary: {
      developerName: res.developerName ?? null,
      projectName: res.projectName ?? null,
      availability: res.availability ?? null,
      size: res.size ?? null,
      floor: res.floor ?? null,
      totalFloors: res.totalFloors ?? null,
      buildYear: res.buildYear ?? null,
      occupancy: res.occupancy ?? null,
      parking: res.parking ?? null,
      availabilityDate: res.availabilityDate ?? null,
    },
  };
}
