/**
 * Formatting helpers for the rich Activity Log cards. Ported from web
 * `boh-lead-magnet/.../components/ActivityTimelineEntry.tsx` (the inline helper
 * functions) + `utils/leadsTableFormatters.ts`, trimmed to what the mobile
 * timeline renders. Keeps display logic out of the component.
 */

import { CALL_OUTCOME_OPTIONS } from '@/features/callService/constants';
import { isEncryptedContactValue } from '@/lib/contact-encryption';
import { maskEmail, maskPhone } from '@/lib/contact-mask';

import type { LeadActivity, LeadActivityMetadata } from '../../models/lead-activity';
import type { BadgeTone } from '../../types';

const CONTACT_FIELD_NAMES = new Set(['email', 'phone', 'whatsappNumber', 'number']);

/** Shown in place of an `enc:v1:…` value that could not be decrypted. */
const MASKED_ENCRYPTED_VALUE = '*****';

/** "request_a_call_back" → "Request A Call Back". */
export function formatLabel(value: string): string {
  return value.replaceAll('_', ' ').replaceAll(/\b\w/g, (char) => char.toUpperCase());
}

/** Performer display name; `public_upsert` source events are attributed to System. */
export function getPerformerName(activity: LeadActivity): string {
  const source = activity.metadata?.source;
  if (source === 'public_upsert') {
    return 'System';
  }
  return activity.performedByName ?? activity.metadata?.performer_name ?? 'System';
}

/** Role line under an avatar; suppressed for System. */
export function getDisplayedPerformerRole(
  activity: LeadActivity,
  defaultRole: string,
): string | undefined {
  if (getPerformerName(activity) === 'System') {
    return undefined;
  }
  return activity.performedByRole ?? defaultRole;
}

/** "11:00 AM" from an ISO timestamp, or undefined when absent/invalid. */
export function formatClockTime(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Call duration in human units: "45 Seconds" / "3 Minutes". */
export function formatCallDuration(seconds: number | undefined): string | undefined {
  if (seconds === undefined || Number.isNaN(seconds) || seconds <= 0) {
    return undefined;
  }
  if (seconds < 60) {
    return `${String(seconds)} ${seconds === 1 ? 'Second' : 'Seconds'}`;
  }
  const minutes = Math.round(seconds / 60);
  return `${String(minutes)} ${minutes === 1 ? 'Minute' : 'Minutes'}`;
}

/** Maps a raw call-outcome value to its display label. */
export function formatCallOutcome(outcome: string | undefined): string | undefined {
  if (!outcome) return undefined;
  const matched = CALL_OUTCOME_OPTIONS.find((option) => option.value === outcome);
  return matched?.label ?? formatLabel(outcome);
}

// ---------------------------------------------------------------------------
// Status / priority badge mapping (raw metadata string → tone + label)
// ---------------------------------------------------------------------------

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[\s-]+/g, '_');
}

const STATUS_TONE_BY_KEY: Record<string, BadgeTone> = {
  new: 'infoSoft',
  new_lead: 'infoSoft',
  contacted: 'infoSoft',
  qualified: 'successSoft',
  viewing_scheduled: 'infoSoft',
  working_deal: 'warningSoft',
  future_prospect: 'mutedSoft',
  did_not_respond: 'mutedSoft',
  unqualified: 'destructiveSoft',
  closed_deal: 'successSoft',
  lost_deal: 'destructiveSoft',
  re_opened: 'warningSoft',
};

export function getStatusTone(status: string): BadgeTone {
  return STATUS_TONE_BY_KEY[normalizeKey(status)] ?? 'mutedSoft';
}

/** "new_lead" → "New"; otherwise Title Case. */
export function formatStatusLabel(status: string): string {
  if (normalizeKey(status) === 'new_lead') {
    return 'New';
  }
  return formatLabel(status);
}

const PRIORITY_TONE_BY_KEY: Record<string, BadgeTone> = {
  hot: 'destructiveSoft',
  warm: 'warningSoft',
  cold: 'infoSoft',
};

export function getPriorityTone(priority: string): BadgeTone {
  return PRIORITY_TONE_BY_KEY[normalizeKey(priority)] ?? 'mutedSoft';
}

export function formatPriorityLabel(priority: string): string {
  const trimmed = priority.trim();
  if (!trimmed) return '-';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Field-change rendering (created / updated / qualification_updated diffs)
// ---------------------------------------------------------------------------

const FIELD_NAME_OVERRIDES: Record<string, string> = {
  cta: 'CTA',
  entryPointId: 'Entry Point',
  leadType: 'Activity Type',
  source: 'Source',
  projectName: 'Project Name',
  state: 'State',
  neighbourhood: 'Neighbourhood',
  budgetRange: 'Budget Range',
  askingPrice: 'Asking Price',
  leadPropertyUse: 'Property Use',
  dealBreaker: 'Deal Breaker',
  areaMin: 'Min Area',
  areaMax: 'Max Area',
  areaUnit: 'Area Unit',
  channelMeta: 'Channel Details',
  callPreference: 'Call Preference',
  interestType: 'Interest Type',
  propertyType: 'Property Type',
  specifyInterest: 'Specify Interest',
  additionalNotes: 'Additional Notes',
};

export function formatFieldName(field: string): string {
  if (FIELD_NAME_OVERRIDES[field]) {
    return FIELD_NAME_OVERRIDES[field];
  }
  return field
    .replaceAll(/([A-Z])/g, ' $1')
    .replaceAll(/^./g, (char) => char.toUpperCase())
    .trim();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tryParseStructuredString(value: string): unknown {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

function formatDisplayString(value: string): string {
  if (value === '') return '-';
  if (
    value.includes('://') ||
    value.includes('@') ||
    value.startsWith('+') ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value)
  ) {
    return value;
  }
  return formatLabel(value);
}

function maskContactFieldValue(field: string, value: string): string {
  if (field === 'email') {
    return maskEmail(value) ?? value;
  }
  return maskPhone(value) ?? value;
}

function formatFieldValue(value: unknown, canViewContact: boolean): string {
  if (value === null || value === undefined) return '-';

  if (isEncryptedContactValue(value)) {
    return MASKED_ENCRYPTED_VALUE;
  }

  if (typeof value === 'string') {
    const parsed = tryParseStructuredString(value);
    if (parsed !== value) {
      return formatFieldValue(parsed, canViewContact);
    }
    return formatDisplayString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatFieldValue(entry, canViewContact)).join(', ');
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(
        ([key, entryValue]) =>
          `${formatFieldName(key)}: ${formatKeyedFieldValue(key, entryValue, canViewContact)}`,
      );
    return entries.length > 0 ? entries.join(' | ') : '-';
  }

  return '-';
}

/**
 * Formats a value with awareness of its field key. Masks contact fields
 * (`email`, `phone`, `whatsappNumber`, `number`) when the caller lacks
 * `leads:view_contact`, recursing so nested objects (e.g. `channelMeta.phone`)
 * are masked too.
 */
export function formatKeyedFieldValue(
  field: string,
  value: unknown,
  canViewContact: boolean,
): string {
  // Still-encrypted snapshot (`enc:v1:…`) — decryption key missing or payload
  // unreadable. Never render the ciphertext, regardless of contact permission.
  if (isEncryptedContactValue(value)) {
    return MASKED_ENCRYPTED_VALUE;
  }
  if (
    !canViewContact &&
    typeof value === 'string' &&
    value !== '' &&
    CONTACT_FIELD_NAMES.has(field)
  ) {
    return maskContactFieldValue(field, value);
  }
  return formatFieldValue(value, canViewContact);
}

export interface FieldChange {
  field: string;
  label: string;
  /** Rendered value, already masked / diffed ("old → new" when changed). */
  value: string;
}

/**
 * Builds the per-field change rows for a created/updated/qualification event.
 * `newValue` keys drive the row set; `oldValue` supplies the "from" side.
 */
export function buildFieldChanges(
  oldValue: Record<string, unknown> | null | undefined,
  newValue: Record<string, unknown> | null | undefined,
  canViewContact: boolean,
): FieldChange[] {
  const oldVal = oldValue ?? {};
  const newVal = newValue ?? {};
  return Object.keys(newVal).map((field) => {
    const formattedOld = formatKeyedFieldValue(field, oldVal[field], canViewContact);
    const formattedNew = formatKeyedFieldValue(field, newVal[field], canViewContact);
    const changed = formattedOld !== formattedNew && Object.hasOwn(oldVal, field);
    return {
      field,
      label: formatFieldName(field),
      value: changed ? `${formattedOld} → ${formattedNew}` : formattedNew,
    };
  });
}

// ---------------------------------------------------------------------------
// Message channel + type
// ---------------------------------------------------------------------------

export type MessageChannel = 'whatsapp' | 'sms' | 'email';

export function getMessageChannel(action: LeadActivity['action']): MessageChannel {
  if (action === 'whatsapp_sent' || action === 'whatsapp_received') return 'whatsapp';
  if (action === 'email_sent') return 'email';
  return 'sms';
}

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  text: 'Message',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  location: 'Location',
  contacts: 'Contact',
  sticker: 'Sticker',
  template: 'Template',
  button: 'Button Reply',
  interactive: 'Interactive',
};

export function getMessageTypeLabel(meta: LeadActivityMetadata | null): string {
  const raw = meta?.message_type ?? (meta?.messageType as string | undefined) ?? 'text';
  return MESSAGE_TYPE_LABELS[raw] ?? 'Message';
}
