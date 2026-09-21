export type ProjectAvailability = 'off_plan' | 'ready';
export type PriceValue = string | number | null;
export type NumberOrString = number | string | null;

export interface PublicProjectImage {
  img_url: string;
}

export interface PublicProjectDeveloper {
  brandName: string;
  developer_logo?: string | null;
}

export interface PublicProjectListItem {
  projectId: string;
  slug: string;
  projectName: string;
  locationLine: string;
  city?: string;
  neighborhood?: string;
  heroImageUrl?: PublicProjectImage[];
  heroPrimaryImageUrl?: string;
  developer: PublicProjectDeveloper;
  availability?: ProjectAvailability;
  propertyType?: string;
  propertyUse?: string;
  startingPrice?: PriceValue;
  publicStartingPrice?: PriceValue;
  paymentPlan?: string | null;
  handover?: string | null;
  listings?: { price?: number | null }[];
}

export interface PublicProjectsListResponse {
  items: PublicProjectListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PublicProjectsFilters {
  search?: string;
  status?: 'all' | 'Ready' | 'Off-Plan';
  propertyType?: string;
  beds?: string[];
  baths?: string[];
  city?: string;
  priceRange?: string;
  handover?: string;
}

export interface PublicProjectsQuery extends PublicProjectsFilters {
  page: number;
  limit: number;
}

export interface StateOption {
  id: string;
  city: string;
}

// ---------- Detail (mirrors ProjectPublicPageResponseDto from backend) ----------

export interface ProjectMediaItem {
  id: string;
  mediaUrl: string;
  mediaType: string;
  originalName?: string;
  altText?: string | null;
  isHero?: boolean;
  sortOrder?: number;
  createdAt?: string;
}

export interface ProjectHeroSection {
  projectName: string | null;
  locationLine: string | null;
  media: ProjectMediaItem[];
}

export interface ProjectOverviewBlock {
  text: string;
  altText: string | null;
  image: ProjectMediaItem | null;
}

export interface ProjectOverviewSection {
  mainTitle: string;
  blocks: ProjectOverviewBlock[];
}

export interface ProjectHighlights {
  title?: string | null;
  tagline?: string | null;
  developer: { id: string; brandName: string; developer_logo?: string | null };
  developmentStage: string;
  availability: string;
  propertyUse?: string | null;
  lifestyleStandard?: string | null;
  handoverDate?: string | null;
  startingPrice?: string | null;
  publicStartingPrice?: string | null;
  unitLowestPrice?: string | null;
  brochureUrl?: string | null;
}

export interface PaymentPlanMilestone {
  name: string;
  percentage: number;
}

export interface ProjectPaymentPlans {
  isVisible: boolean;
  title: string;
  sectionImage: ProjectMediaItem | null;
  plan?: {
    id: string;
    name: string;
    milestones: PaymentPlanMilestone[];
  } | null;
}

export interface ProjectAmenityItem {
  id: string;
  amenityId: string;
  name: string;
  slug: string;
  icon?: string | null;
  description: string;
  isCustom: boolean;
  isVisible: boolean;
  sortOrder: number;
  media: ProjectMediaItem[];
}

export interface ProjectAmenitiesSection {
  title?: string | null;
  tagline?: string | null;
  items: ProjectAmenityItem[];
  selectedCount: number;
  totalCount: number;
}

export interface LocationEntry {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sortOrder: number;
  driveTimeMinutes?: number;
}

export interface DistanceGroup {
  id: string;
  rangeLabel: string;
  sortOrder: number;
  entries: LocationEntry[];
}

export interface LocationCategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  icon?: string | null;
  title: string;
  isCustom: boolean;
  isVisible: boolean;
  sortOrder: number;
  distanceGroups: DistanceGroup[];
}

export interface ProjectLocationSection {
  title: string;
  tagline?: string | null;
  mainHeading: string;
  subtitle?: string | null;
  mapCenter?: { latitude: number; longitude: number } | null;
  customPinLocation?: { latitude: number; longitude: number } | null;
  categories: LocationCategory[];
  categoryCount: number;
  locationUnavailable?: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ProjectFaqSection {
  items: FaqItem[];
  count: number;
}

export interface UnitTypesFloorPlanLayout {
  layoutId: string;
  name: string;
  size: number | null;
  price: number | null;
  floorPlanUrl: string | null;
  floorPlanImageUrl: string | null;
  selected: boolean;
  enabled: boolean;
}

export interface UnitTypesFloorPlanUnitType {
  unitTypeId: string;
  unitType: string;
  bedrooms: number | null;
  sizeRange: { min: number | null; max: number | null };
  priceRange: { min: number | null; max: number | null };
  selected: boolean;
  selectedFloorPlans: number;
  totalFloorPlans: number;
  layouts: UnitTypesFloorPlanLayout[];
}

export interface UnitTypesFloorPlanPropertyType {
  propertyType: string;
  selected: boolean;
  unitTypes: UnitTypesFloorPlanUnitType[];
}

export interface ProjectUnitTypesFloorPlans {
  propertyTypes: UnitTypesFloorPlanPropertyType[];
}

export interface ProjectPublicPageSections {
  hero: ProjectHeroSection | null;
  overview: ProjectOverviewSection | null;
  highlights?: ProjectHighlights;
  paymentPlans?: ProjectPaymentPlans;
  unitTypesFloorPlans: ProjectUnitTypesFloorPlans | null;
  amenities: ProjectAmenitiesSection | null;
  location: ProjectLocationSection | null;
  faq: ProjectFaqSection | null;
}

export interface PublicProjectDetail {
  id: string;
  projectId: string;
  projectName: string;
  locationLine: string | null;
  slug: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  sections: ProjectPublicPageSections;
}

// ---------- Listings (separate endpoint) ----------

export interface PublicListingItem {
  id: string;
  slug: string;
  projectSlug?: string;
  title?: string;
  bedrooms?: NumberOrString;
  bathrooms?: NumberOrString;
  area?: NumberOrString;
  size?: NumberOrString;
  price?: NumberOrString;
  view?: string | null;
  propertyType?: string | null;
  heroImageUrl?: string | null;
}
