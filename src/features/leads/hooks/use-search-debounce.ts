import { useEffect } from 'react';
import { useLeadsFilterStore } from '../store/filter.store';

const DEBOUNCE_MS = 300;

export function useSearchDebounceSync(): void {
  const searchInput = useLeadsFilterStore((s) => s.searchInput);
  const setDebouncedSearch = useLeadsFilterStore((s) => s.setDebouncedSearch);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput, setDebouncedSearch]);
}
