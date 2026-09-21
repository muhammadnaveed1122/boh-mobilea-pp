import type { BadgeProps } from '@/components/atoms/Badge';
import type { CallRecord } from '../models/call-record';

export type BadgeVariant = NonNullable<BadgeProps['variant']>;

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${String(m)}m ${String(s).padStart(2, '0')}s` : `${String(s)}s`;
}

/** Media clock — `m:ss`, used by the audio player timers (tabular figures). */
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

export function formatDateTime(iso: string | null): string {
  if (iso === null) return '—';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today · ${time}`;
  if (isYest) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString()} · ${time}`;
}

/** CDR numbers can be URL-encoded ("%2B92…"=+92…) or junk ("false"). */
export function displayNumber(value: string | null): string {
  if (value === null || value === '' || value === 'false') return '—';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function outcomeBadge(status: string | null): { label: string; variant: BadgeVariant } {
  switch (status ?? '') {
    case 'answered':
      return { label: 'Connected', variant: 'successSoft' };
    case 'missed':
      return { label: 'No Answer', variant: 'mutedSoft' };
    case 'busy':
      return { label: 'Busy', variant: 'warningSoft' };
    case 'failed':
      return { label: 'Disconnected', variant: 'destructiveSoft' };
    default:
      return { label: status ?? '—', variant: 'mutedSoft' };
  }
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const SOURCE_LABELS: Record<string, string> = {
  speed_to_lead: 'Speed to Lead',
  dialer: 'Dialer',
  reception: 'Reception',
  webhook: 'Webhook',
  telesales: 'Campaign',
};

export function sourceLabel(source: string | null): string {
  return source !== null && source in SOURCE_LABELS ? SOURCE_LABELS[source] : '—';
}

export function sourceBadgeVariant(source: string | null): BadgeVariant {
  switch (source ?? '') {
    case 'speed_to_lead':
      return 'infoSoft';
    case 'dialer':
      return 'secondary';
    case 'reception':
      return 'successSoft';
    case 'webhook':
      return 'warningSoft';
    case 'telesales':
      return 'brandSoft';
    default:
      return 'mutedSoft';
  }
}

export function campaignLabel(source: string | null): string {
  switch (source ?? '') {
    case 'dialer':
      return 'Manual call';
    case 'reception':
      return 'Reception';
    case 'speed_to_lead':
      return 'Speed to Lead';
    case 'telesales':
      return 'Campaign';
    default:
      return '—';
  }
}

/**
 * "Campaign / Widget" display value. Prefers the server-resolved `campaignName`,
 * falls back to the locally-loaded campaign map for telesales, then to the
 * generic source-derived label. Mirrors the web resolution order.
 */
export function resolveCampaign(
  record: Pick<CallRecord, 'source' | 'campaignId' | 'campaignName'>,
  campaignNameById: Map<string, string>,
): string {
  if (record.campaignName != null && record.campaignName !== '') return record.campaignName;
  if (record.source === 'telesales') {
    return record.campaignId ? (campaignNameById.get(record.campaignId) ?? 'Campaign') : 'Campaign';
  }
  return campaignLabel(record.source);
}
