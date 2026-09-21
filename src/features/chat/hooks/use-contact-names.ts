/**
 * Resolves display names against the agent's saved phonebook.
 *
 * Precedence: saved contact name > WhatsApp profile name > raw number. Mirrors
 * the web client's `useContactNames`, so the same customer reads identically on
 * both clients.
 */

import { useCallback, useMemo } from 'react';

import { useAgentContacts } from './use-agent-contacts';

/**
 * Reduce a number to comparable digits. Saved contacts are stored E.164 but
 * conversation rows arrive in mixed shapes (`+971 50 123 4567`, `971501234567`),
 * so both sides are normalized before matching.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Deterministic avatar palette. Contrast-checked against white foreground text
 * in both themes — these are fixed brand-neutral hues rather than theme tokens
 * so a given contact keeps the same colour when the user flips light/dark.
 */
const AVATAR_COLORS = [
  '#0EA5E9',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#6366F1',
  '#14B8A6',
] as const;

/** Stable hash → palette index. Same seed always yields the same colour. */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export interface ContactNameResolver {
  /** Best display name for a number, falling back through the precedence chain. */
  resolve: (phone: string | null | undefined, fallback?: string | null) => string;
  /** Whether this number is already in the agent's phonebook. */
  isSaved: (phone: string | null | undefined) => boolean;
}

export function useContactNames(): ContactNameResolver {
  const { data } = useAgentContacts();

  const byPhone = useMemo(() => {
    const map = new Map<string, string>();
    for (const contact of data ?? []) {
      map.set(normalizePhone(contact.phone), contact.name);
    }
    return map;
  }, [data]);

  const resolve = useCallback(
    (phone: string | null | undefined, fallback?: string | null): string => {
      const saved = phone ? byPhone.get(normalizePhone(phone)) : undefined;
      if (saved !== undefined && saved !== '') return saved;
      if (fallback !== undefined && fallback !== null && fallback !== '') return fallback;
      return phone ?? '';
    },
    [byPhone],
  );

  const isSaved = useCallback(
    (phone: string | null | undefined): boolean =>
      phone ? byPhone.has(normalizePhone(phone)) : false,
    [byPhone],
  );

  return useMemo(() => ({ resolve, isSaved }), [resolve, isSaved]);
}
