// src/features/favorites/services.ts
import { apiClient } from '@/lib/api';
import {
  type ClientFavoriteAllResponse,
  type FavoriteCreatedResponse,
  type FavoriteListKind,
  FavoriteResourceKind,
  type PaginatedClientFavoriteListings,
  type PaginatedClientFavoriteProjects,
} from './types';

const BASE = '/api/v1/client/favorites';

export async function addFavorite(
  kind: FavoriteResourceKind,
  id: string,
): Promise<FavoriteCreatedResponse> {
  const { data } = await apiClient.post<FavoriteCreatedResponse>(BASE, { kind, id });
  return data;
}

export async function removeFavorite(kind: FavoriteResourceKind, id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${kind}/${encodeURIComponent(id)}`);
}

interface GetFavoritesParams {
  kind: FavoriteListKind;
  page: number;
  limit: number;
}

export async function getFavoriteProjects(
  page: number,
  limit: number,
): Promise<PaginatedClientFavoriteProjects> {
  const { data } = await apiClient.get<PaginatedClientFavoriteProjects>(BASE, {
    params: { kind: 'project', page, limit } satisfies GetFavoritesParams,
  });
  return data;
}

export async function getFavoriteListings(
  page: number,
  limit: number,
): Promise<PaginatedClientFavoriteListings> {
  const { data } = await apiClient.get<PaginatedClientFavoriteListings>(BASE, {
    params: { kind: 'listing', page, limit } satisfies GetFavoritesParams,
  });
  return data;
}

export async function getAllFavorites(
  page: number,
  limit: number,
): Promise<ClientFavoriteAllResponse> {
  const { data } = await apiClient.get<ClientFavoriteAllResponse>(BASE, {
    params: { kind: 'all', page, limit } satisfies GetFavoritesParams,
  });
  return data;
}
