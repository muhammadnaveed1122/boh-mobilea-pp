/**
 * Location lookup models for the City / Area selects.
 *
 * Web fetches these from `GET /locations/states` and
 * `GET /locations/neighbourhoods` (paginated `{ items, meta }`). Mobile only
 * needs `id` + `name` to drive the dropdowns and resolve the saved value's
 * label, so the model is intentionally minimal.
 */

export interface LocationItem {
  readonly id: string;
  readonly name: string;
}

export interface LocationListParams {
  /** Free-text search forwarded to the backend. */
  readonly search?: string;
  /** Neighbourhoods only: restrict to a single state. */
  readonly stateId?: string;
}
