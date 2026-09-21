import { create } from 'zustand';

export const COMPARE_MAX = 4;

export interface CompareItem {
  readonly id: string;
  readonly label: string;
  readonly subLabel?: string;
  readonly imageUrl?: string | null;
}

interface CompareState {
  /** Whether the Project List is in "select to compare" mode. */
  compareMode: boolean;
  /** Selected projects, insertion order, capped at COMPARE_MAX. */
  items: CompareItem[];
  setCompareMode: (on: boolean) => void;
  /** Add when absent (and under the cap); remove when already selected. */
  toggle: (item: CompareItem) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/**
 * Project comparison selection. Lives in a store (not screen state) so the
 * selection survives list refetches and the navigation to the compare screen.
 * Turning compare mode off also clears the selection.
 */
export const useCompareStore = create<CompareState>((set) => ({
  compareMode: false,
  items: [],
  setCompareMode: (on) => set(on ? { compareMode: true } : { compareMode: false, items: [] }),
  toggle: (item) =>
    set((state) => {
      const exists = state.items.some((i) => i.id === item.id);
      if (exists) return { items: state.items.filter((i) => i.id !== item.id) };
      if (state.items.length >= COMPARE_MAX) return state;
      return { items: [...state.items, item] };
    }),
  remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
}));
