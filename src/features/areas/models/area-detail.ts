/**
 * Area-detail models. Mirrors web's `useAreaDetail` hook: an area opens three
 * tabs (New Projects / Sell / Rent), each backed by a different endpoint, all
 * normalized into a single rich card shape (`AreaListingItem`) so they render
 * identically. Raw row types stay loose because the backend returns flat-or-
 * nested project/developer fields.
 */
export type AreaDetailTab = 'new' | 'sell' | 'rent';

/** Normalized rich card — every tab maps its source row into this. */
export interface AreaListingItem {
  readonly id: string;
  readonly imageUrls: string[];
  readonly tag: string;
  readonly title: string;
  readonly price: string;
  readonly updatedAt: string;
  readonly area: string;
  /** Second field differs by source: Developer (projects) vs Owner/Project (listings). */
  readonly secondaryLabel: string;
  readonly secondaryValue: string;
  readonly handover: string;
  readonly bedrooms: string;
  readonly size: string;
  readonly serviceCharge: string;
  /** Mobile listing-detail route target; null when no mobile route exists. */
  readonly listingId: string | null;
  /** Project-management detail route target (New Projects tab); null otherwise. */
  readonly projectId: string | null;
  /** Project-listing extras (raw enum strings; card formats/colors them). Omitted by Areas tabs. */
  readonly status?: string;
  readonly availabilityType?: string;
  readonly trakheesiPermit?: string;
  readonly trakheesiQrCodeUrl?: string | null;
}

export interface AreaListingsPage {
  readonly items: AreaListingItem[];
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
}
