/**
 * App-wide dropdown primitives. A dropdown is defined exactly once as a
 * `DropdownSpec`. Static dropdowns supply an options array; dependent ones
 * supply a pure resolver `(ctx) => options`. Zero feature coupling.
 */

export interface DropdownOption {
  readonly value: string;
  readonly label: string;
}

export interface DropdownSpec<Ctx = void> {
  /** Stable id, e.g. `'furnishing'`, `'propertyType'`. */
  readonly id: string;
  readonly label: string;
  readonly placeholder: string | ((ctx: Ctx) => string);
  readonly options: readonly DropdownOption[] | ((ctx: Ctx) => readonly DropdownOption[]);
}

/** Resolve a spec's options for a given context (array or resolver). */
export function resolveOptions<Ctx>(spec: DropdownSpec<Ctx>, ctx: Ctx): readonly DropdownOption[] {
  return typeof spec.options === 'function' ? spec.options(ctx) : spec.options;
}

/** Resolve a spec's placeholder for a given context. */
export function resolvePlaceholder<Ctx>(spec: DropdownSpec<Ctx>, ctx: Ctx): string {
  return typeof spec.placeholder === 'function' ? spec.placeholder(ctx) : spec.placeholder;
}
