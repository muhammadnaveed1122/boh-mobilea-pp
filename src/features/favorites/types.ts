// src/features/favorites/types.ts
export enum FavoriteResourceKind {
  LISTING = 'listing',
  PROJECT = 'project',
}

export type FavoriteListKind = 'listing' | 'project' | 'all';

export interface FavoriteCreatedResponse {
  id: string;
  createdAt: string;
}

export interface ClientFavoriteProjectDeveloper {
  id: string;
  brandName: string;
  logoUrl: string | null;
}

export interface ClientFavoriteProjectItem {
  favoriteId: string;
  favoritedAt: string;
  inquirySent: boolean;
  projectId: string;
  projectName: string;
  slug: string | null;
  propertyUse: string | null;
  propertyType: string | null;
  locationLine: string | null;
  startingPrice: number | null;
  heroImageUrl: string | null;
  developer: ClientFavoriteProjectDeveloper;
}

export interface FavoriteListingProject {
  id: string;
  projectName: string;
  slug?: string | null;
}

export interface FavoriteListingUnitType {
  bedrooms: number;
  bathrooms?: number | null;
  sizeMin?: number | null;
  sizeMax?: number | null;
}

export interface FavoritePublicListing {
  id: string;
  title: string;
  price?: number | null;
  slug?: string | null;
  heroImageUrl?: string | null;
  project: FavoriteListingProject;
  unitType: FavoriteListingUnitType;
}

export interface ClientFavoriteListingItem {
  favoriteId: string;
  favoritedAt: string;
  inquirySent: boolean;
  listing: FavoritePublicListing;
}

export interface PaginatedFavorites<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type PaginatedClientFavoriteProjects = PaginatedFavorites<ClientFavoriteProjectItem>;
export type PaginatedClientFavoriteListings = PaginatedFavorites<ClientFavoriteListingItem>;

export interface ClientFavoriteAllResponse {
  listings: PaginatedClientFavoriteListings;
  projects: PaginatedClientFavoriteProjects;
  // backend also returns `opportunityListings` — intentionally omitted (out of scope)
}
