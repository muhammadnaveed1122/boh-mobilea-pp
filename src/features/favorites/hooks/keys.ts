// src/features/favorites/hooks/keys.ts
export const favoritesKeys = {
  all: ['favorites'] as const,
  snapshot: () => [...favoritesKeys.all, 'snapshot'] as const,
  list: (kind: 'project' | 'listing') => [...favoritesKeys.all, 'list', kind] as const,
};
