/**
 * Areas (neighbourhoods) models. Mirrors the web `Neighbourhood` shape from
 * `boh-lead-magnet/src/features/locations/models/neighbourhood.ts`, kept full
 * (counts + image + state) because the Areas grid renders all of it — unlike
 * the leads City/Area selects which only need id+name.
 */
export interface AreaState {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface AreaCounts {
  readonly new: number;
  readonly sell: number;
  readonly rent: number;
}

export interface Area {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly state: AreaState;
  readonly image?: string | null;
  readonly imageAltText?: string | null;
  readonly counts: AreaCounts;
}

export interface AreasMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface AreasPage {
  readonly items: Area[];
  readonly meta: AreasMeta;
}

export interface AreaPropertyTypeOption {
  readonly value: string;
  readonly label: string;
}

export interface NeighbourhoodsPageParams {
  readonly page: number;
  readonly limit?: number;
  readonly search?: string;
  readonly stateId?: string;
  readonly propertyType?: string;
}
