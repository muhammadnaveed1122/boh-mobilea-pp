/**
 * Token-driven background/foreground class pairs for lead status pills.
 * Uses semantic NativeWind classes only — no hex.
 *
 * Web reference: `STATUS_STYLES` in `boh-mobile/src/features/leads/data.ts`.
 */

import type { BadgeProps } from '@/components/atoms/Badge';

import { LeadStatus } from '../../constants/lead-enums';

export interface StatusStyle {
  bgClass: string;
  fgClass: string;
  /** Tinted Badge variant equivalent of the bg/fg pair. */
  variant: NonNullable<BadgeProps['variant']>;
}

export const STATUS_STYLES: Record<LeadStatus, StatusStyle> = {
  [LeadStatus.NEW]: { bgClass: 'bg-info-soft', fgClass: 'text-info', variant: 'infoSoft' },
  [LeadStatus.CONTACTED]: { bgClass: 'bg-info-soft', fgClass: 'text-info', variant: 'infoSoft' },
  [LeadStatus.QUALIFIED]: {
    bgClass: 'bg-success-soft',
    fgClass: 'text-success',
    variant: 'successSoft',
  },
  [LeadStatus.VIEWING_SCHEDULED]: {
    bgClass: 'bg-info-soft',
    fgClass: 'text-info',
    variant: 'infoSoft',
  },
  [LeadStatus.WORKING_DEAL]: {
    bgClass: 'bg-warning-soft',
    fgClass: 'text-warning',
    variant: 'warningSoft',
  },
  [LeadStatus.FUTURE_PROSPECT]: {
    bgClass: 'bg-muted',
    fgClass: 'text-muted-foreground',
    variant: 'mutedSoft',
  },
  [LeadStatus.DID_NOT_RESPOND]: {
    bgClass: 'bg-muted',
    fgClass: 'text-muted-foreground',
    variant: 'mutedSoft',
  },
  [LeadStatus.UNQUALIFIED]: {
    bgClass: 'bg-destructive-soft',
    fgClass: 'text-destructive',
    variant: 'destructiveSoft',
  },
  [LeadStatus.CLOSED_DEAL]: {
    bgClass: 'bg-success-soft',
    fgClass: 'text-success',
    variant: 'successSoft',
  },
  [LeadStatus.LOST_DEAL]: {
    bgClass: 'bg-destructive-soft',
    fgClass: 'text-destructive',
    variant: 'destructiveSoft',
  },
  [LeadStatus.RE_OPENED]: {
    bgClass: 'bg-warning-soft',
    fgClass: 'text-warning',
    variant: 'warningSoft',
  },
};

const FALLBACK_STATUS_STYLE: StatusStyle = {
  bgClass: 'bg-muted',
  fgClass: 'text-muted-foreground',
  variant: 'mutedSoft',
};

export function getStatusStyle(value: string | null | undefined): StatusStyle {
  if (value && (Object.values(LeadStatus) as string[]).includes(value)) {
    return STATUS_STYLES[value as LeadStatus];
  }
  return FALLBACK_STATUS_STYLE;
}
