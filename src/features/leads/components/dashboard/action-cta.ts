import type { IconName } from '@/components/atoms/Icon';
import type { BadgeTone } from '../../types';

interface CtaMeta {
  tone: BadgeTone;
  icon: IconName;
}

const CTA: Record<string, CtaMeta> = {
  'Contact Now': { tone: 'destructiveSoft', icon: 'PhoneCall' },
  'Follow Up': { tone: 'infoSoft', icon: 'Clock' },
  'Convert to Deal': { tone: 'successSoft', icon: 'Handshake' },
  Negotiation: { tone: 'infoSoft', icon: 'MessagesSquare' },
  'View Deal': { tone: 'infoSoft', icon: 'Eye' },
  View: { tone: 'infoSoft', icon: 'Eye' },
};

const DEFAULT_META: CtaMeta = { tone: 'infoSoft', icon: 'Bell' };

export interface ActionCta {
  label: string;
  tone: BadgeTone;
  icon: IconName;
}

/** Maps a backend `actionType` to a CTA chip label + tone + icon, with a safe default. */
export function actionCta(actionType?: string | null): ActionCta {
  if (!actionType) return { label: 'Follow Up', ...DEFAULT_META, tone: 'infoSoft', icon: 'Clock' };
  const meta = CTA[actionType] ?? DEFAULT_META;
  return { label: actionType, tone: meta.tone, icon: meta.icon };
}

/** Accent-bar Tailwind bg class per tone (solid, for the card edge). */
export const TONE_BAR: Record<BadgeTone, string> = {
  destructiveSoft: 'bg-destructive',
  warningSoft: 'bg-warning',
  successSoft: 'bg-success',
  infoSoft: 'bg-info',
  mutedSoft: 'bg-muted-foreground',
};

/** Theme token per tone, for native icon color values. */
export const TONE_TOKEN = {
  destructiveSoft: '--destructive',
  warningSoft: '--warning',
  successSoft: '--success',
  infoSoft: '--info',
  mutedSoft: '--muted-foreground',
} as const satisfies Record<BadgeTone, string>;
