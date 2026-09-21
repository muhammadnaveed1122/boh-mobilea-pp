/**
 * Resolves lead context for a live call so screens can render lead-aware
 * chips (persona / interest, property type, source). Tries the explicit
 * `leadId` first (set on outbound calls); falls back to a phone search for
 * inbound calls where the contactId is unknown.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getLeads } from '@/features/leads/services';
import { useLeadDetail } from '@/features/leads/hooks/use-lead-detail';
import type { LeadListItem } from '@/features/leads/types';

const MAX_CHIPS = 3;
const MAX_CHIP_LEN = 26;

function humanize(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function clipChip(text: string): string {
  if (text.length <= MAX_CHIP_LEN) return text;
  return `${text.slice(0, MAX_CHIP_LEN - 1).trimEnd()}…`;
}

function firstInterestType(lead: { interestType?: string | string[] }): string | undefined {
  const it = lead.interestType;
  if (!it) return undefined;
  if (Array.isArray(it)) return typeof it[0] === 'string' ? it[0] : undefined;
  return typeof it === 'string' ? it : undefined;
}

interface ChipSource {
  interest?: string | null;
  interestType?: string | string[];
  propertyType?: string | null;
  leadType?: { name?: string } | null;
}

function buildChips(lead: ChipSource | undefined): string[] {
  if (!lead) return [];
  const chips: string[] = [];

  const persona = typeof lead.interest === 'string' ? lead.interest : null;
  const interestType = firstInterestType(lead);
  if (persona && interestType) {
    chips.push(clipChip(`${humanize(persona)} · ${humanize(interestType)}`));
  } else if (persona) {
    chips.push(clipChip(humanize(persona)));
  } else if (interestType) {
    chips.push(clipChip(humanize(interestType)));
  }

  if (lead.propertyType && typeof lead.propertyType === 'string') {
    chips.push(clipChip(humanize(lead.propertyType)));
  }

  const source = lead.leadType?.name;
  if (source) {
    chips.push(clipChip(humanize(source)));
  }

  return chips.slice(0, MAX_CHIPS);
}

function pickLeadFromList(items: LeadListItem[] | undefined): LeadListItem | undefined {
  if (!items || items.length === 0) return undefined;
  return items[0];
}

export interface CallLeadContext {
  leadId: string | null;
  displayName: string | null;
  chips: string[];
  isLoading: boolean;
}

export function useCallLeadContext(
  contactId: string | null | undefined,
  phone: string | null | undefined,
): CallLeadContext {
  const byId = useLeadDetail(contactId ?? undefined);

  const phoneEnabled = !contactId && !!phone && phone.length >= 4;
  const byPhone = useQuery({
    queryKey: ['lead-by-phone', phone],
    queryFn: () => getLeads({ search: phone ?? '', limit: 1 }),
    enabled: phoneEnabled,
    staleTime: 60_000,
  });

  return useMemo<CallLeadContext>(() => {
    if (contactId && byId.data) {
      const d = byId.data;
      return {
        leadId: d.id,
        displayName: d.name ?? null,
        chips: buildChips({
          interest: typeof d.interest === 'string' ? d.interest : null,
          interestType: Array.isArray(d.interestType)
            ? (d.interestType.filter((v) => typeof v === 'string') as string[])
            : undefined,
          propertyType: typeof d.propertyType === 'string' ? d.propertyType : null,
          leadType: d.leadType ? { name: d.leadType.name } : null,
        }),
        isLoading: byId.isLoading,
      };
    }
    if (phoneEnabled) {
      const match = pickLeadFromList(byPhone.data?.items);
      if (match) {
        return {
          leadId: match.id,
          displayName: match.name ?? null,
          chips: buildChips({
            propertyType: match.propertyType ?? null,
            leadType: match.leadType ?? null,
          }),
          isLoading: byPhone.isLoading,
        };
      }
      return { leadId: null, displayName: null, chips: [], isLoading: byPhone.isLoading };
    }
    return { leadId: null, displayName: null, chips: [], isLoading: byId.isLoading };
  }, [contactId, byId.data, byId.isLoading, phoneEnabled, byPhone.data, byPhone.isLoading]);
}
