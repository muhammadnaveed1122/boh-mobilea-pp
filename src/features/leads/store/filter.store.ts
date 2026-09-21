import { create } from 'zustand';
import type { LeadInterest, LeadInterestType, LeadPriority, LeadStatus } from '../types';

export type LeadFilterValue = 'All' | LeadStatus;

interface LeadsFilterState {
  filter: LeadFilterValue;
  interest: LeadInterest | null;
  interestType: LeadInterestType | null;
  priority: LeadPriority | null;
  searchInput: string;
  debouncedSearch: string;
  setFilter: (filter: LeadFilterValue) => void;
  setInterest: (v: LeadInterest | null) => void;
  setInterestType: (v: LeadInterestType | null) => void;
  setPriority: (v: LeadPriority | null) => void;
  setSearchInput: (value: string) => void;
  setDebouncedSearch: (value: string) => void;
  resetAdvanced: () => void;
  reset: () => void;
}

const INITIAL = {
  filter: 'All' as LeadFilterValue,
  interest: null,
  interestType: null,
  priority: null,
  searchInput: '',
  debouncedSearch: '',
};

export const useLeadsFilterStore = create<LeadsFilterState>((set) => ({
  ...INITIAL,
  setFilter: (filter) => set({ filter }),
  setInterest: (interest) => set({ interest }),
  setInterestType: (interestType) => set({ interestType }),
  setPriority: (priority) => set({ priority }),
  setSearchInput: (searchInput) => set({ searchInput }),
  setDebouncedSearch: (debouncedSearch) => set({ debouncedSearch }),
  resetAdvanced: () => set({ interest: null, interestType: null, priority: null }),
  reset: () => set({ ...INITIAL }),
}));

export function selectActiveFilterCount(state: LeadsFilterState): number {
  let n = 0;
  if (state.interest) n += 1;
  if (state.interestType) n += 1;
  if (state.priority) n += 1;
  return n;
}
