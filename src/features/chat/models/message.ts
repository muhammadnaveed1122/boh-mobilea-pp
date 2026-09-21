import type { Channel } from './channel';

export type MessageDirection = 'in' | 'out';

/**
 * Outbound delivery state — drives the tick glyph on a bubble. Mirrors the
 * WhatsApp ladder: pending (clock) → sent (single grey tick) → delivered
 * (double grey tick) → read (double blue tick). `failed` shows a red alert.
 */
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Renderable media kinds (others fall back to a text placeholder). */
export type MediaKind = 'image' | 'video' | 'document' | 'audio';

/** Media attached to a received/sent message. */
export interface MessageMedia {
  messageId: string;
  kind: MediaKind;
  /** Signed URL if known up-front; otherwise resolved lazily by messageId. */
  url?: string;
  mimeType?: string;
  /** Display name for documents. */
  name?: string;
}

/** A shared geographic location (WhatsApp location message). */
export interface MessageLocation {
  latitude: number;
  longitude: number;
  /** Named place label, when the sender picked a saved place. */
  name?: string;
  /** Street address, when provided. */
  address?: string;
}

/**
 * A shared phonebook entry (WhatsApp `contacts` message). One message can
 * carry several; each may list more than one number.
 */
export interface MessageContact {
  name: string;
  /** Display-ready phone numbers, in payload order. May be empty. */
  phones: string[];
}

/** A locally-picked asset queued for sending. */
export interface PickedAsset {
  uri: string;
  name: string;
  mimeType: string;
  kind: MediaKind;
  /** Duration in ms — set for recorded voice notes. */
  durationMs?: number;
}

export interface Message {
  id: string;
  /**
   * Stable render key that survives the optimistic → server swap. Set to the
   * originating `tmp_…` id once a server message is matched to a bubble this
   * client just sent, so the row keeps its identity (no remount, no re-entry
   * animation) when only the delivery tick changes.
   */
  clientKey?: string;
  channel: Channel;
  direction: MessageDirection;
  /** Body text / caption. For email this is the plain-text body. */
  text: string;
  /** Email subject line. Present only for `channel === 'email'`. */
  subject?: string;
  /** Pre-formatted display time, e.g. `"9:17 AM"`. */
  time: string;
  /** Set on outbound messages only. */
  status?: MessageStatus;
  /** Sender label for outbound messages, e.g. `"Sansa Stark"`. */
  senderName?: string;
  /** Sender's primary role, e.g. `"Agent"` — shown next to the name. */
  senderRole?: string;
  /** Grouping label for the day divider, e.g. `"Yesterday"` / `"Today"`. */
  dayLabel: string;
  /** Present when the message carries renderable media. */
  media?: MessageMedia;
  /** Present when the message shares a geographic location. */
  location?: MessageLocation;
  /** Present when the message shares one or more phonebook contacts. */
  contacts?: MessageContact[];
  /** Resolved reference to the parent message this bubble is replying to. */
  replyTo?: MessageReplyRef;
  /** Aggregated reactions to render under the bubble. */
  reactions?: ReactionAggregate[];
}

/**
 * A lightweight quote pointer used to render a "replying to" preview inside
 * a bubble. Carries just enough to paint the quoted strip and resolve the
 * parent when the user taps it; the parent's full payload is looked up by id
 * from the cached message list.
 */
/**
 * Compact reaction count returned by the backend per emoji per message.
 * `mine` is computed for the requesting agent; `true` means tapping that
 * pill will remove the agent's own reaction.
 */
export interface ReactionAggregate {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface MessageReplyRef {
  /** Parent chat message ID. */
  id: string;
  /** Short text preview of the parent (text, caption, or media placeholder). */
  snippet: string;
  /** Author label: "You" for outbound parents, lead name for inbound. */
  author: 'self' | 'them';
  /** Parent's channel so the quoted strip can carry the matching accent. */
  channel: Channel;
}

/** Payload accepted by the composer's send action. */
export type SendPayload =
  | {
      channel: 'whatsapp';
      text: string;
      attachment?: PickedAsset;
      location?: MessageLocation;
      replyTo?: MessageReplyRef;
    }
  | { channel: 'email'; subject: string; text: string; replyTo?: MessageReplyRef }
  | { channel: 'messenger'; text: string; attachment?: PickedAsset; replyTo?: MessageReplyRef };
