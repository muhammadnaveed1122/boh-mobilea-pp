// "Properties" (Buy) feature — mirrors the web buy-with-us mixed feed.
// Two sources feed one unified card model:
//  - buy projects   → GET /api/v1/public/projects?type=buy   (each nested listing → one card)
//  - opportunity     → GET /api/v1/opportunity-listing/public (one item → one card)
// Detail pages normalise both backend shapes into a single `PropertyDetail`.

export type PropertyKind = 'buy-project' | 'opportunity';

export type PropertyBadge = 'Ready' | 'Off-Plan';

/** Agent assigned to a listing; surfaced in the card's contact bar (mirrors web). */
export interface AssignedAgent {
  id: string;
  name: string;
  avatarUrl?: string | null;
  email?: string | null;
}

/**
 * One carousel slide. The backend tags each media row `image` or `video`;
 * dropping that tag renders videos through <Image>, which yields a blank slide.
 */
export interface PropertyCardMedia {
  url: string;
  type: 'image' | 'video';
}

/** Unified card shown in the home carousel and the full list. */
export interface PropertyCard {
  /** Stable React key — unique across both sources. */
  id: string;
  kind: PropertyKind;
  /** Listing UUID used for favourites (`FavoriteResourceKind.LISTING`). */
  favoriteId: string;
  title: string;
  propertyType?: string;
  media: PropertyCardMedia[];
  location?: string;
  beds?: number;
  baths?: number;
  /** Pre-formatted area, e.g. "1,274 sqft". */
  area?: string;
  priceLabel: string;
  /** Numeric price (AED) for client-side filtering/sorting; undefined when unknown. */
  priceValue?: number;
  badge?: PropertyBadge;
  /** ISO timestamp used to sort the mixed feed newest-first. */
  timestamp?: string;
  /** Assigned agent shown in the contact bar; null when none/inactive. */
  assignedAgent?: AssignedAgent | null;
  /** Human listing reference (S-1042 / R-1042) — quoted in the Call dialog and the enquiry. */
  reference?: string;
  // ---- detail target (discriminated by `kind`) ----
  /** buy-project: parent project slug. */
  projectSlug?: string;
  /** buy-project: listing slug. */
  listingSlug?: string;
  /** opportunity: global listing slug. */
  slug?: string;
}

// ---------- Buy projects list (type=buy) ----------

export interface BuyProjectImage {
  img_url: string;
}

export interface BuyListingItem {
  id: string;
  reference?: string | null;
  title?: string | null;
  price?: number | null;
  slug?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sizeMin?: number | null;
  sizeMax?: number | null;
  heroImageUrl?: string | null;
  createdAt?: string | null;
  publishedAt?: string | null;
  assignedAgent?: AssignedAgent | null;
}

export interface BuyProjectItem {
  projectId: string;
  slug: string;
  projectName?: string | null;
  locationLine?: string | null;
  cityName?: string | null;
  neighborhood?: string | null;
  heroImageUrl?: BuyProjectImage[] | null;
  heroPrimaryImageUrl?: string | null;
  availability?: 'off_plan' | 'ready' | null;
  publishedAt?: string | null;
  listings?: BuyListingItem[] | null;
}

export interface BuyProjectsResponse {
  items: BuyProjectItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------- Opportunity listings list ----------

export interface OpportunityListMediaItem {
  sectionKey: string;
  mediaUrl: string;
  mediaType: string;
  sortOrder: number;
}

export interface OpportunityListProperty {
  propertyType: string | null;
  unitType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  builtUpArea: string | null;
  builtUpAreaUnit: string | null;
  view: string | null;
  furnishing: string | null;
  buildingProjectAddress: string | null;
  state: { id: string; name: string } | null;
  neighbourhood: { id: string; name: string } | null;
}

export interface OpportunityListItem {
  id: string;
  reference?: string | null;
  title: string | null;
  price: number | null;
  slug: string | null;
  createdAt: string;
  publishedAt?: string | null;
  heroImageUrl: string | null;
  media: OpportunityListMediaItem[];
  property: OpportunityListProperty;
  assignedAgent?: AssignedAgent | null;
}

export interface OpportunityListResponse {
  items: OpportunityListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------- Normalised detail (mirrors web ListingCmsData) ----------

export interface PropertyMedia {
  type: 'image' | 'video';
  url: string;
  altText?: string;
}

export interface PropertyAttribute {
  /** Lucide icon name (resolved by the section component). */
  icon: string;
  label: string;
  value: string;
}

export interface PropertyAmenityItem {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string;
  media: PropertyMedia[];
}

export interface PropertyLocationEntry {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface PropertyLocationDistanceGroup {
  rangeLabel: string;
  entries: PropertyLocationEntry[];
}

export interface PropertyLocationCategory {
  name: string;
  distanceGroups: PropertyLocationDistanceGroup[];
}

export interface PropertyLocationSection {
  title?: string;
  tagline?: string;
  customPinLocation?: { latitude: number; longitude: number };
  categories: PropertyLocationCategory[];
}

export interface PropertyAgent {
  name: string;
  role?: string;
  avatarUrl?: string;
  phone?: string;
  whatsapp?: string;
}

export interface PropertyDetail {
  listingId?: string;
  /** Human listing reference (S-1042 / R-1042) — quoted in the enquiry as "Reference No.". */
  reference?: string;
  title: string;
  location?: string;
  priceLabel: string;
  /** Numeric price (AED) for the sticky bar; 0 when unknown. */
  price: number;
  hero: { mainTitle?: string; subTitle?: string; media: PropertyMedia[] };
  attributes: PropertyAttribute[];
  about?: {
    mainTitle?: string;
    texts: string[];
    additionalDescription?: string;
    media: PropertyMedia[];
  };
  amenities?: { title?: string; tagline?: string; items: PropertyAmenityItem[] };
  locationSection?: PropertyLocationSection;
  faq: { question: string; answer: string }[];
  trakheesi?: { permitNumber?: string; qrCodeUrl?: string; qrCodeAltText?: string };
  agent?: PropertyAgent;
}

/**
 * Listing/project attribution carried by the "Request Call back" lead, so the created lead links
 * back to the record the caller was looking at. Mirrors web `ContactProjectContext`.
 */
export interface ListingCallContext {
  reference?: string;
  projectId?: string;
  projectSlug?: string;
  /** Primary (project) listing slug — mutually exclusive with `opportunityListingSlug`. */
  listingSlug?: string;
  listingId?: string;
  /** Secondary (opportunity) listing slug + id. */
  opportunityListingSlug?: string;
  opportunityListingId?: string;
  /** Absolute public web URL of the listing — sent as `channelMeta.page`. */
  pageUrl?: string;
}

/** Unauthenticated lead created by the listing "Request Call back" form. */
export interface ListingCallbackLeadPayload {
  leadType: 'request_a_call_back';
  name: string;
  phone: string;
  channel: 'public_website';
  channelMeta: { page?: string; cta: string; entryPointId: string };
  callPreference?: { date: string; time: string; timezone: string };
  projectIds?: string[];
  projectSlug?: string;
  listingSlug?: string;
  listingIds?: string[];
  opportunityListingSlug?: string;
  opportunityListingIds?: string[];
}

/** Discriminated detail-fetch target. */
export type PropertyDetailTarget =
  | { kind: 'buy-project'; projectSlug: string; listingSlug: string }
  | { kind: 'opportunity'; slug: string };
