/**
 * Shared types for the reusable property dropdown components.
 *
 * Mirrors `boh-lead-magnet/src/components/molecules/dropdowns/property/types.ts`
 * adapted for React Native: value-based `onChange` that can clear the
 * selection, an optional static read-only render, and an optional portal host
 * for selects mounted inside modals/cards.
 */

export interface DropdownOption {
  readonly value: string;
  readonly label: string;
}

export interface BaseDropdownProps {
  /** Field label. Each concrete `*Select` supplies a sensible default. */
  readonly label?: string;
  /** Current selected value (canonical backend snake_case string). */
  readonly value?: string;
  /** Fires with the new value, or `undefined` when the selection is cleared. */
  readonly onChange: (value: string | undefined) => void;
  /** Placeholder shown when nothing is selected. */
  readonly placeholder?: string;
  /** Interactive but not selectable (e.g. waiting on a parent dropdown). */
  readonly disabled?: boolean;
  /** Render as a static read-only tile instead of an interactive select. */
  readonly readOnly?: boolean;
  /** Inline validation error message. */
  readonly error?: string;
  /** Helper text shown under the field when there is no error. */
  readonly hint?: string;
  /** Portal host name for the dropdown popover (modal contexts). */
  readonly portalHost?: string;
}
