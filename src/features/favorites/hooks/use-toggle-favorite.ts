// src/features/favorites/hooks/use-toggle-favorite.ts
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { addFavorite, removeFavorite } from '../services';
import {
  type ClientFavoriteAllResponse,
  FavoriteResourceKind,
  type PaginatedFavorites,
} from '../types';
import { favoritesKeys } from './keys';

interface ToggleVars {
  kind: FavoriteResourceKind;
  id: string;
  /** Current favourited state (from the snapshot) — we flip it. */
  isFavorite: boolean;
}

function emptyPage<T>(): PaginatedFavorites<T> {
  return { items: [], total: 0, page: 1, limit: 100, totalPages: 0 };
}

export function useToggleFavorite(): UseMutationResult<
  void,
  Error,
  ToggleVars,
  { previous?: ClientFavoriteAllResponse }
> {
  const qc = useQueryClient();

  return useMutation<void, Error, ToggleVars, { previous?: ClientFavoriteAllResponse }>({
    mutationFn: async ({ kind, id, isFavorite }) => {
      if (isFavorite) {
        await removeFavorite(kind, id);
      } else {
        await addFavorite(kind, id);
      }
    },
    onMutate: async ({ kind, id, isFavorite }) => {
      await qc.cancelQueries({ queryKey: favoritesKeys.snapshot() });
      const previous = qc.getQueryData<ClientFavoriteAllResponse>(favoritesKeys.snapshot());

      qc.setQueryData<ClientFavoriteAllResponse>(favoritesKeys.snapshot(), (old) => {
        const base: ClientFavoriteAllResponse = old ?? {
          projects: emptyPage(),
          listings: emptyPage(),
        };
        // Optimistic ADD is intentionally a cache no-op: the tapped button shows
        // the new state via its local `override`, and `onSettled` invalidation
        // refetches the real snapshot. We deliberately do NOT insert a stub item
        // (it would render an incomplete ghost row on the Favourites page until
        // the refetch lands). Optimistic REMOVE prunes immediately so the row
        // disappears at once.
        if (kind === FavoriteResourceKind.PROJECT) {
          const items = isFavorite
            ? base.projects.items.filter((p) => p.projectId !== id)
            : base.projects.items;
          return { ...base, projects: { ...base.projects, items } };
        }
        const items = isFavorite
          ? base.listings.items.filter((l) => l.listing.id !== id)
          : base.listings.items;
        return { ...base, listings: { ...base.listings, items } };
      });

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(favoritesKeys.snapshot(), ctx.previous);
      }
      console.warn('[favorites] toggle failed; reverted');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: favoritesKeys.all }).catch(() => {});
    },
  });
}
