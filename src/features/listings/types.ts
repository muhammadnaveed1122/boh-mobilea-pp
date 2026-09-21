/**
 * Secondary (opportunity) listings — types + display maps.
 *
 * Mirrors the web `opportunity-listing` feature. The backend feature is named
 * "opportunity-listing"; on mobile we surface it under the Listings tab.
 */

export type ListingStatus =
  | 'draft'
  | 'in_review'
  | 're_review'
  | 'changes_requested'
  | 'approved'
  | 'active'
  | 'inactive'
  | 'archived';

export type PriceTrend = 'up' | 'down' | 'none';

export interface StageSummary {
  id: string;
  name: string;
  color: string;
}

export interface ListingAssignee {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface ListingListItem {
  id: string;
  name?: string | null;
  heroTitle?: string | null;
  heroImageUrl?: string | null;
  status: ListingStatus;
  urlSlug?: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  opportunityId?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  propertyLabel?: string | null;
  agentName?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  builtUpArea?: string | null;
  builtUpAreaUnit?: string | null;
  price?: number | null;
  askingPrice?: string | null;
  propertyType?: string | null;
  propertyUse?: string | null;
  stateName?: string | null;
  neighbourhoodName?: string | null;
  assigneeId?: string | null;
  assignee?: ListingAssignee | null;
  permitNumber?: string | null;
  publishedBy?: string | null;
  previousPrice?: number | null;
  priceTrend?: PriceTrend;
  unitNumber?: string | null;
  stage?: StageSummary | null;
  isPushedToPropertyFinder?: boolean;
  pfListingId?: string | null;
  createdByName?: string | null;
  purpose?: 'sell' | 'rent' | null;
}

export interface PaginatedListings {
  items: ListingListItem[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  /** Listing count per stage id within the current filter set (for stage pills). */
  stageCounts?: Record<string, number>;
}

export interface ListingsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: ListingStatus;
  includeArchived?: boolean;
  agentId?: string;
  property?: string;
  purpose?: 'for_sale' | 'for_rent';
  lifecycle?: ListingsLifecycle;
  stageId?: string;
  /** Inclusive ISO (`YYYY-MM-DD`) creation-date window. */
  dateFrom?: string;
  dateTo?: string;
}

export interface ListingAgent {
  id: string;
  name: string;
}

/* ----------------------------------------------------------------- detail */

export interface ListingMediaItem {
  id: string;
  sectionKey: string;
  mediaUrl: string;
  mediaType: string;
  originalName?: string | null;
  altText?: string | null;
  sortOrder: number;
}

export interface ListingAmenity {
  id: string;
  amenityId?: string;
  customTitle?: string | null;
  customDescription?: string | null;
  sortOrder?: number;
  amenity?: {
    id: string;
    name: string;
    slug?: string;
    icon?: string | null;
  } | null;
}

export interface ListingDerived {
  propertyType?: string | null;
  unitType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  view?: string | null;
  furnishing?: string | null;
  askingPrice?: string | null;
  builtUpArea?: string | null;
  /** Sale vs rent intent from the opportunity; drives purpose-aware detail UI. */
  purpose?: 'for_sale' | 'for_rent' | null;
  /** Rent price period label (e.g. "yearly", "monthly"); null for sale/unset. */
  priceType?: string | null;
  /** Security deposit, stored as a string; null if unset. */
  deposit?: string | null;
  /** Maximum number of rent cheques accepted; null if unset. */
  maxCheques?: number | null;
}

export interface ListingPersonRef {
  id: string;
  name?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
}

export interface ListingHeroSection {
  title?: string | null;
  subtitle?: string | null;
}

export interface ListingAboutSection {
  title?: string | null;
  subtitle?: string | null;
  textSection1?: string | null;
  textSection2?: string | null;
  additionalDescription?: string | null;
}

export interface ListingHighlightsSection {
  title?: string | null;
  subtitle?: string | null;
  propertyType?: string | null;
  unitType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  view?: string | null;
  furnishing?: string | null;
  builtUpArea?: string | null;
  builtUpAreaUnit?: string | null;
  price?: number | null;
}

export interface ListingLocationSection {
  title?: string | null;
  subtitle?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  categoryTabs?: unknown[];
}

export interface ListingSeoSection {
  metaTitle?: string | null;
  urlSlug?: string | null;
  metaDescription?: string | null;
  ogImageAltText?: string | null;
}

export interface ListingSections {
  hero?: ListingHeroSection;
  about?: ListingAboutSection;
  highlights?: ListingHighlightsSection;
  location?: ListingLocationSection;
  seo?: ListingSeoSection;
}

export type TrakheesiPermitStatus = 'not_applied' | 'applied' | 'approved' | 'expired';

export interface ListingTrakheesiPermit {
  status: TrakheesiPermitStatus;
  permitNumber?: string | null;
  qrCodeUrl?: string | null;
  qrCodeAltText?: string | null;
  expiryDate?: string | null;
}

/** Primary (project) listing-only facts, surfaced in a dedicated detail card. */
export interface ListingPrimaryInfo {
  developerName?: string | null;
  projectName?: string | null;
  availability?: string | null;
  size?: number | null;
  floor?: string | null;
  totalFloors?: string | null;
  buildYear?: string | null;
  occupancy?: string | null;
  parking?: string | null;
  availabilityDate?: string | null;
}

export interface ListingDetail {
  id: string;
  opportunityId?: string | null;
  name?: string | null;
  status: ListingStatus;
  urlSlug?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  submittedAt?: string | null;
  changeNotes?: string | null;
  changesRequestedAt?: string | null;
  agentNotes?: string | null;
  createdAt?: string | null;
  updatedAt: string;
  createdBy?: ListingPersonRef | null;
  assigneeId?: string | null;
  assignee?: ListingAssignee | null;
  agentInfo?: ListingPersonRef | null;
  isReviewer?: boolean;
  sections: ListingSections;
  media: Record<string, ListingMediaItem[]>;
  amenities: ListingAmenity[];
  derived: ListingDerived;
  trakheesiPermit?: ListingTrakheesiPermit | null;
  /** Present only for primary (project) listings; drives the Project Details card. */
  primary?: ListingPrimaryInfo | null;
}

/* ------------------------------------------------------------ display maps */

export type BadgeTone =
  | 'successSoft'
  | 'infoSoft'
  | 'warningSoft'
  | 'destructiveSoft'
  | 'mutedSoft';

export const STATUS_LABEL: Record<ListingStatus, string> = {
  draft: 'Draft',
  in_review: 'Pending Review',
  re_review: 'Pending Re-Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  active: 'Published',
  inactive: 'Inactive',
  archived: 'Archived',
};

export const STATUS_BADGE_VARIANT: Record<ListingStatus, BadgeTone> = {
  draft: 'mutedSoft',
  in_review: 'infoSoft',
  re_review: 'infoSoft',
  changes_requested: 'warningSoft',
  approved: 'successSoft',
  active: 'successSoft',
  inactive: 'mutedSoft',
  archived: 'mutedSoft',
};

export const STATUS_FILTERS: readonly ListingStatus[] = [
  'draft',
  'in_review',
  're_review',
  'changes_requested',
  'approved',
  'active',
  'inactive',
  'archived',
];

export const TRAKHEESI_STATUS_LABEL: Record<TrakheesiPermitStatus, string> = {
  not_applied: 'Not Applied',
  applied: 'Applied',
  approved: 'Approved',
  expired: 'Expired',
};

export const TRAKHEESI_BADGE_VARIANT: Record<TrakheesiPermitStatus, BadgeTone> = {
  not_applied: 'mutedSoft',
  applied: 'infoSoft',
  approved: 'successSoft',
  expired: 'destructiveSoft',
};

/* ----------------------------------------------------- unified listings */

export type ListingKind = 'primary' | 'secondary';
export type ListingMarket = 'all' | 'primary' | 'secondary';
export type ListingsLifecycle = 'active' | 'inactive' | 'sold';
/** Sale vs rent — the page-level intent. Maps to API 'for_sale' | 'for_rent'. */
export type ListingsPurpose = 'sale' | 'rent';
export type ListingPortal = 'property_finder' | 'bayut' | 'dubizzle' | 'whatsapp';

/**
 * Coerce any purpose spelling the API/route may use into the canonical
 * `'sale' | 'rent'`. Accepts `sell`/`sale`/`for_sale` and `rent`/`for_rent`
 * (case-insensitive); returns `null` for anything unrecognised so callers can
 * fall back gracefully.
 */
export function normalizeListingPurpose(value?: string | null): ListingsPurpose | null {
  switch (value?.toLowerCase()) {
    case 'sale':
    case 'sell':
    case 'for_sale':
      return 'sale';
    case 'rent':
    case 'for_rent':
      return 'rent';
    default:
      return null;
  }
}

/** Shared row shape for both data sources (mirror of the web UnifiedListingRow). */
export interface UnifiedListingRow {
  id: string;
  kind: ListingKind;
  title: string;
  status: string;
  isPublished?: boolean | null;
  price: number | null;
  previousPrice: number | null;
  priceTrend: PriceTrend;
  stage: StageSummary | null;
  projectName?: string | null;
  developerName?: string | null;
  propertyLabel?: string | null;
  permitNumber?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sizeSqft?: number | null;
  unitNumber?: string | null;
  location?: string | null;
  heroImageUrl?: string | null;
  agentName?: string | null;
  createdByName?: string | null;
  assigneeId?: string | null;
  portals?: ListingPortal[];
  purpose?: string | null;
  updatedAt?: string | null;
  leadId?: string | null;
  opportunityId?: string | null;
  slug?: string | null;
}

/* ----------------------------------------------- primary (project) listings */

export interface PrimaryListingItem {
  id: string;
  slug?: string;
  title?: string;
  projectName?: string;
  project?: { id: string; projectName?: string; slug?: string };
  developerId?: string;
  developerName?: string;
  propertyUse?: string;
  price?: number | null;
  previousPrice?: number | null;
  status: string;
  isPublished?: boolean | null;
  purpose?: 'for_sale' | 'for_rent';
  bedrooms?: number;
  bathrooms?: number;
  sizeSqft?: number | null;
  propertyType?: string;
  neighbourhoodName?: string | null;
  unitNumber?: string | null;
  unitType?: {
    propertyType?: string;
    bedrooms?: number;
    bathrooms?: number;
    sizeMin?: number | null;
    sizeMax?: number | null;
  };
  assigneeId?: string | null;
  assignee?: ListingAssignee | null;
  createdByName?: string | null;
  isPushedToPropertyFinder?: boolean;
  pfListingId?: string | null;
  heroImageUrls?: string[];
  stage?: StageSummary | null;
  priceTrend?: PriceTrend;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrimaryPaginatedListings {
  items: PrimaryListingItem[];
  total: number;
  totalForScope?: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Listing count per stage id within the current filter set (for stage pills). */
  stageCounts?: Record<string, number>;
}

export interface PrimaryListingsQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  status?: string;
  purpose?: 'for_sale' | 'for_rent';
  lifecycle?: ListingsLifecycle;
  developerId?: string;
  propertyUse?: string;
  assigneeId?: string;
  stageId?: string;
  /** Inclusive ISO (`YYYY-MM-DD`) creation-date window. */
  dateFrom?: string;
  dateTo?: string;
}

export interface ListingDeveloperOption {
  value: string;
  label: string;
}

/* ------------------------------------------------------------------ stages */

export type StageDomain = 'listing' | 'telesales';
export type StagePurpose = 'sale' | 'rent' | 'outreach';

/** Ordered pipeline stage for one {domain, purpose, lifecycle} scope. */
export interface ListingStage {
  id: string;
  domain: StageDomain;
  purpose: StagePurpose;
  lifecycle: ListingsLifecycle;
  name: string;
  color: string;
  sortOrder: number;
}

export interface StageScope {
  domain: StageDomain;
  purpose: StagePurpose;
  lifecycle: ListingsLifecycle;
}
