import type { ProjectMediaItem } from '../types';

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i;

export function isVideoMedia(m: ProjectMediaItem | undefined | null): boolean {
  if (!m) return false;
  if (m.mediaType === 'video') return true;
  return VIDEO_EXT.test(m.mediaUrl ?? '');
}

export function isPersistedMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

export function sortMedia(items: ProjectMediaItem[] | undefined): ProjectMediaItem[] {
  if (!items?.length) return [];
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
