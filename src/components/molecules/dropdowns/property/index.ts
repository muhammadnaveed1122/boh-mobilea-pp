/**
 * Shared property dropdown primitive.
 *
 * The legacy per-field `*Select` wrappers and the cascade-helper re-exports
 * were removed once the dynamic lead-requirements form (DependentSelect +
 * `@/components/dropdowns` catalog) replaced them. Only the low-level
 * `FieldSelect` atom and its prop types remain — `DependentSelect` builds on
 * them.
 */

export { FieldSelect, type FieldSelectProps } from './FieldSelect';
export type { BaseDropdownProps, DropdownOption } from './types';
