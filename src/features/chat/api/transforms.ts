import { differenceInCalendarDays, format, isToday, isYesterday, parseISO } from 'date-fns';

import { htmlToText } from '@/lib/html-to-text';
import { trimQuotedReply } from './trim-quoted-reply';
import { isMessengerChannel } from '../models/channel';
import type { Channel } from '../models/channel';
import type {
  MediaKind,
  Message,
  MessageContact,
  MessageDirection,
  MessageLocation,
  MessageMedia,
  MessageStatus,
} from '../models/message';
import type { ChatContact } from '../models/conversation';
import type { ApiConversation, ApiMessage, ApiMessageStatus } from './types';

/** Subset of fields needed to decide whether a record is an email. */
interface ChannelLike {
  channel?: string | null;
  type?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function resolveChannel(m: ChannelLike): Channel {
  const ch = (m.channel ?? '').toLowerCase();
  if (isMessengerChannel(m.channel)) return 'messenger';
  if (ch === 'email') return 'email';

  const t = (m.type ?? '').toLowerCase();
  if (t === 'email' || t === 'mail') return 'email';

  const meta = m.metadata ?? {};
  const metaType = meta.type;
  if (typeof metaType === 'string' && metaType.toLowerCase() === 'email') return 'email';

  const subject = meta.subject;
  if ((ch === 'unified' || ch === '') && typeof subject === 'string' && subject.trim() !== '') {
    return 'email';
  }
  return 'whatsapp';
}

export function mapStatus(status: ApiMessageStatus | null | undefined): MessageStatus | undefined {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'delivered':
      return 'delivered';
    case 'read':
      return 'read';
    case 'failed':
      return 'failed';
    case 'sent':
      return 'sent';
    default:
      return 'sent';
  }
}

const MEDIA_PLACEHOLDERS: Record<string, string> = {
  image: '[Image]',
  video: '[Video]',
  audio: '[Audio]',
  voice: '[Audio]',
  document: '[Document]',
  location: '[Location]',
  contacts: '[Contact]',
  sticker: '[Sticker]',
};

export function mediaPlaceholder(type: string | null | undefined): string {
  if (!type) return '';
  return MEDIA_PLACEHOLDERS[type.toLowerCase()] ?? '';
}

/** Backend media `type` → renderable kind, or null (text-placeholder kinds). */
export function mediaKind(type: string | null | undefined): MediaKind | null {
  switch ((type ?? '').toLowerCase()) {
    case 'image':
    case 'sticker':
      return 'image';
    case 'video':
      return 'video';
    case 'audio':
    case 'voice':
      return 'audio';
    case 'document':
      return 'document';
    default:
      return null;
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

/** Coerce a metadata value to a finite number (backend may send it stringified). */
function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Build a location from a `type: 'location'` message's metadata, if it has coords. */
function toLocation(
  type: string | null | undefined,
  meta: Record<string, unknown>,
): MessageLocation | undefined {
  if ((type ?? '').toLowerCase() !== 'location') return undefined;
  const latitude = num(meta.latitude);
  const longitude = num(meta.longitude);
  if (latitude === undefined || longitude === undefined) return undefined;
  return {
    latitude,
    longitude,
    name: str(meta.name),
    address: str(meta.address),
  };
}

/** Shape of one entry inside a WhatsApp `contacts` payload (all fields optional). */
interface RawContact {
  name?: { formatted_name?: string; first_name?: string; last_name?: string } | null;
  phones?: { phone?: string; wa_id?: string }[] | null;
}

function contactName(c: RawContact, phones: string[]): string {
  const n = c.name ?? {};
  const composed = [str(n.first_name), str(n.last_name)].filter(Boolean).join(' ');
  return str(n.formatted_name) ?? str(composed) ?? phones[0] ?? 'Shared contact';
}

/**
 * Build the shared-contact cards from a `type: 'contacts'` message's metadata.
 * The backend persists the raw WhatsApp payload under `metadata.contacts` for
 * both directions; older rows may hold it JSON-stringified.
 */
function toContacts(
  type: string | null | undefined,
  meta: Record<string, unknown>,
): MessageContact[] | undefined {
  if ((type ?? '').toLowerCase() !== 'contacts') return undefined;
  let raw = meta.contacts;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const contacts = (raw as RawContact[]).map((c) => {
    const phones = Array.isArray(c.phones)
      ? c.phones.map((p) => str(p?.phone) ?? str(p?.wa_id)).filter((p): p is string => Boolean(p))
      : [];
    return { name: contactName(c, phones), phones: [...new Set(phones)] };
  });
  return contacts.length > 0 ? contacts : undefined;
}

function safeParse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatClockTime(iso: string | null | undefined): string {
  const d = safeParse(iso);
  return d ? format(d, 'h:mm a') : '';
}

export function dayLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const d = safeParse(iso);
  if (!d) return '';
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  const diff = differenceInCalendarDays(now, d);
  if (diff > 1 && diff < 7) return format(d, 'EEE');
  return format(d, 'MMM d');
}

/** Inbox preview time: clock if today, otherwise the day label. */
export function formatInboxTime(iso: string | null | undefined, now: Date = new Date()): string {
  const d = safeParse(iso);
  if (!d) return '';
  return isToday(d) ? formatClockTime(iso) : dayLabel(iso, now);
}

function bodyText(m: Pick<ApiMessage, 'content' | 'caption' | 'type'>): string {
  // Media messages: never surface raw `content` — inbound Messenger media stores
  // the CDN URL there. Prefer a real caption, otherwise a typed placeholder.
  if (mediaKind(m.type)) {
    return m.caption && m.caption.trim() !== '' ? m.caption : mediaPlaceholder(m.type);
  }
  if (m.content && m.content.trim() !== '') return m.content;
  if (m.caption && m.caption.trim() !== '') return m.caption;
  return mediaPlaceholder(m.type);
}

/**
 * Attribute an outbound message to the agent who sent it (web shows this too).
 * Inbound messages carry no sender label. Returns a partial spread into Message.
 */
function senderLabel(
  direction: MessageDirection,
  info: ApiMessage['senderInfo'],
): Pick<Message, 'senderName' | 'senderRole'> {
  if (direction !== 'out' || !info) return {};
  const senderName = `${info.firstName} ${info.lastName}`.trim() || undefined;
  const senderRole = info.roles?.[0] ?? undefined;
  return {
    ...(senderName ? { senderName } : {}),
    ...(senderRole ? { senderRole } : {}),
  };
}

export function toMessage(m: ApiMessage, now: Date = new Date()): Message {
  const channel = resolveChannel(m);
  const direction = m.direction === 'outbound' ? 'out' : 'in';
  const subjectRaw = m.metadata?.subject;
  const subject =
    channel === 'email' && typeof subjectRaw === 'string' && subjectRaw.trim() !== ''
      ? subjectRaw
      : undefined;

  const kind = mediaKind(m.type);
  const meta = m.metadata ?? {};
  const location = toLocation(m.type, meta);
  const contacts = toContacts(m.type, meta);
  const media: MessageMedia | undefined = kind
    ? {
        messageId: m.id,
        kind,
        url: m.mediaUrl ?? undefined,
        mimeType: str(meta.mimeType) ?? str(meta.mime_type),
        name: str(meta.filename) ?? str(m.caption),
      }
    : undefined;

  // For media, show only a real caption — drop `content` (Messenger puts the
  // CDN URL there, which must not render as the bubble's text).
  const rawText = media ? (str(m.caption) ?? '') : bodyText(m);
  // Email bodies arrive as raw HTML (Outlook/Gmail markup). Mobile has no HTML
  // renderer — strip to plain text, then trim the quoted reply history (every
  // prior message is already its own bubble) so the bubble shows just the reply.
  const text = channel === 'email' ? trimQuotedReply(htmlToText(rawText)) : rawText;

  const reactions = Array.isArray(m.reactions) && m.reactions.length > 0 ? m.reactions : undefined;

  return {
    id: m.id,
    channel,
    direction,
    text,
    subject,
    time: formatClockTime(m.createdAt),
    status: direction === 'out' ? mapStatus(m.status) : undefined,
    dayLabel: dayLabel(m.createdAt, now),
    ...senderLabel(direction, m.senderInfo),
    ...(media ? { media } : {}),
    ...(location ? { location } : {}),
    ...(contacts ? { contacts } : {}),
    ...(reactions ? { reactions } : {}),
  };
}

function snippetFor(m: ApiMessage): string {
  const t = bodyText(m);
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

export function toMessages(rows: ApiMessage[], now: Date = new Date()): Message[] {
  const sorted = [...rows].sort((a, b) => {
    const ta = safeParse(a.createdAt)?.getTime() ?? 0;
    const tb = safeParse(b.createdAt)?.getTime() ?? 0;
    return ta - tb;
  });
  // Build parent index first so each transformed bubble can carry a resolved
  // `replyTo` reference for the UI (used to render the quoted strip + scroll).
  const byId = new Map<string, ApiMessage>();
  for (const m of sorted) byId.set(m.id, m);

  return sorted.map((m) => {
    const base = toMessage(m, now);
    const parentId =
      typeof m.metadata?.replyToMessageId === 'string' ? m.metadata.replyToMessageId : undefined;
    if (!parentId) return base;
    const parent = byId.get(parentId);
    if (!parent) return base;
    return {
      ...base,
      replyTo: {
        id: parent.id,
        snippet: snippetFor(parent),
        author: parent.direction === 'outbound' ? 'self' : 'them',
        channel: resolveChannel(parent),
      },
    };
  });
}

export function toChatContact(c: ApiConversation, now: Date = new Date()): ChatContact {
  const lm = c.latestMessage ?? null;
  const lastChannel = lm ? resolveChannel(lm) : resolveChannel({ channel: c.channel });
  const lastMessage = lm ? bodyText(lm) : '';
  const name =
    (c.customerName && c.customerName.trim() !== '' ? c.customerName : null) ??
    (c.customerPhone && c.customerPhone.trim() !== '' ? c.customerPhone : null) ??
    (c.customerEmail && c.customerEmail.trim() !== '' ? c.customerEmail : null) ??
    'Unknown';
  const phone = c.customerPhone && c.customerPhone.trim() !== '' ? c.customerPhone : undefined;
  return {
    id: c.id,
    name,
    lastMessage,
    lastChannel,
    lastTime: formatInboxTime(c.lastMessageAt, now),
    unread: c.unreadCount ?? 0,
    phone,
    windowExpiresAt: c.windowExpiresAt ?? null,
  };
}
