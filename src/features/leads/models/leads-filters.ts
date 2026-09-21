/**
 * Leads filter state — the mobile mirror of web's `BoardFilters`.
 *
 * The UI holds arrays; `buildLeadsQuery` flattens them to the comma-separated
 * strings the backend's `toArray()` splits back (same wire shape web sends in
 * `buildBoardQuery.filterParams`). Anything empty is omitted rather than sent
 * blank, so an untouched filter never narrows the result set.
 *
 * Web parity gaps, both deliberate:
 * - `teamId` — admin-only on web (hidden for team-scoped users) and there is no
 *   teams client on mobile.
 * - `financingStatus` — the web filter is commented out pending a product call.
 */

import type { LeadPriority, LeadStatus, LeadsQuery } from '../types';
import type { AssignmentOption } from '../constants/leads-filter-options';

export interface LeadsFilterState {
  /** Free-text search over name / phone / email. */
  search?: string;
  /** Single pipeline status (web calls this "Stage", labels it "Status"). */
  status?: LeadStatus;
  priority?: LeadPriority;
  assignment?: AssignmentOption;
  /** Unified source — matches a leaf on `channel` OR `externalSource`. */
  source?: string;
  portalSource?: string;
  callOutcome?: string;
  /** Off-plan / new-project enquiries only. Cuts across every other filter. */
  newProject?: boolean;
  intentBucket?: 'buy' | 'rent' | 'sell';

  // ── "More filters" ──────────────────────────────────────────────────────
  assigneeId?: string[];
  createdById?: string[];
  stateId?: string[];
  neighbourhoodId?: string[];
  countryCode?: string[];
  bedroomsIn?: string[];
  spokenLanguages?: string[];
  propertyType?: string;
  furnishing?: string;
  view?: string;
  nationality?: string;

  /** Inclusive ISO (`YYYY-MM-DD`) createdAt window. Set by the route, not the sheet. */
  dateFrom?: string;
  dateTo?: string;
}

export const EMPTY_LEADS_FILTERS: LeadsFilterState = {};

/**
 * Keys the filter sheet owns — everything it can set, reset, or count.
 * `status` is deliberately absent: it lives in the always-visible pill row, so
 * counting it here would badge the filter button for a filter the sheet can't
 * change (and give the user two controls for one field).
 */
export const SHEET_FILTER_KEYS = [
  'priority',
  'assignment',
  'source',
  'portalSource',
  'callOutcome',
  'newProject',
  'intentBucket',
  'assigneeId',
  'createdById',
  'stateId',
  'neighbourhoodId',
  'countryCode',
  'bedroomsIn',
  'spokenLanguages',
  'propertyType',
  'furnishing',
  'view',
  'nationality',
] as const satisfies readonly (keyof LeadsFilterState)[];

export type SheetFilterKey = (typeof SHEET_FILTER_KEYS)[number];

/** Every user-facing key — sheet filters plus the status pill row. */
export const ALL_FILTER_KEYS = [
  'status',
  ...SHEET_FILTER_KEYS,
] as const satisfies readonly (keyof LeadsFilterState)[];

export type FilterKey = (typeof ALL_FILTER_KEYS)[number];

function isSet(value: LeadsFilterState[FilterKey]): boolean {
  if (value === undefined || value === '' || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** How many sheet filters are applied — drives the badge on the filter button. */
export function countActiveFilters(filters: LeadsFilterState): number {
  return SHEET_FILTER_KEYS.reduce((n, key) => (isSet(filters[key]) ? n + 1 : n), 0);
}

/** True when at least one sheet filter is applied (search excluded). */
export function hasActiveFilters(filters: LeadsFilterState): boolean {
  return countActiveFilters(filters) > 0;
}

/**
 * Clear every sheet-owned key. Search, the status pill and the route's date
 * window survive — the sheet never owned them, so its Reset must not wipe them.
 */
export function clearSheetFilters(filters: LeadsFilterState): LeadsFilterState {
  return {
    search: filters.search,
    status: filters.status,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };
}

/** Clear every user-facing filter, including the status pill. Keeps search + dates. */
export function clearAllFilters(filters: LeadsFilterState): LeadsFilterState {
  return { search: filters.search, dateFrom: filters.dateFrom, dateTo: filters.dateTo };
}

/** Drop one filter key (chip dismissal). */
export function removeFilter(filters: LeadsFilterState, key: FilterKey): LeadsFilterState {
  const next = { ...filters };
  delete next[key];
  return next;
}

function joined(values: string[] | undefined): string | undefined {
  return values && values.length > 0 ? values.join(',') : undefined;
}

function assignmentParam(assignment: AssignmentOption | undefined): boolean | undefined {
  if (assignment === 'assigned') return true;
  if (assignment === 'unassigned') return false;
  return undefined;
}

/**
 * Filter state → the query the leads endpoint takes. Undefined entries are
 * dropped so the react-query key stays stable as filters come and go.
 */
export function buildLeadsQuery(filters: LeadsFilterState): Omit<LeadsQuery, 'page' | 'limit'> {
  const query: Record<string, unknown> = {
    search: filters.search?.trim() || undefined,
    status: filters.status,
    priority: filters.priority,
    isAssigned: assignmentParam(filters.assignment),
    source: filters.source,
    portalSource: filters.portalSource,
    callOutcome: filters.callOutcome,
    newProject: filters.newProject === true ? true : undefined,
    intentBucket: filters.intentBucket,
    assigneeId: joined(filters.assigneeId),
    createdById: joined(filters.createdById),
    stateId: joined(filters.stateId),
    neighbourhoodId: joined(filters.neighbourhoodId),
    countryCode: joined(filters.countryCode),
    bedroomsIn: joined(filters.bedroomsIn),
    spokenLanguages: joined(filters.spokenLanguages),
    propertyType: filters.propertyType,
    furnishing: filters.furnishing,
    view: filters.view,
    nationality: filters.nationality,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  };

  for (const key of Object.keys(query)) {
    if (query[key] === undefined) delete query[key];
  }
  return query as Omit<LeadsQuery, 'page' | 'limit'>;
}
