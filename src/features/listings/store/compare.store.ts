import { create } from 'zustand';

import type { UnifiedListingRow } from '../types';

export const COMPARE_MAX = 4;

/**
 * Selection identity. Primary and secondary feeds can reuse ids, so the list
 * keys rows by `kind:id` — compare selection uses the same composite key.
 */
export function compareKey(row: Pick<UnifiedListingRow, 'kind' | 'id'>): string {
  return `${row.kind}:${row.id}`;
}

interface CompareState {
  /** Whether the listings list is in "select to compare" mode. */
  compareMode: boolean;
  /** Selected listing rows, insertion order, capped at COMPARE_MAX. */
  items: UnifiedListingRow[];
  setCompareMode: (on: boolean) => void;
  /** Add when absent (and under the cap); remove when already selected. */
  toggle: (row: UnifiedListingRow) => void;
  remove: (key: string) => void;
  clear: () => void;
}

/**
 * Listings comparison selection. Lives in a store (not screen state) so the
 * selection survives list refetches and the navigation to the compare screen.
 * Turning compare mode off also clears the selection.
 */
export const useListingCompareStore = create<CompareState>((set) => ({
  compareMode: false,
  items: [],
  setCompareMode: (on) => set(on ? { compareMode: true } : { compareMode: false, items: [] }),
  toggle: (row) =>
    set((state) => {
      const key = compareKey(row);
      const exists = state.items.some((i) => compareKey(i) === key);
      if (exists) return { items: state.items.filter((i) => compareKey(i) !== key) };
      if (state.items.length >= COMPARE_MAX) return state;
      return { items: [...state.items, row] };
    }),
  remove: (key) => set((state) => ({ items: state.items.filter((i) => compareKey(i) !== key) })),
  clear: () => set({ items: [] }),
}));
