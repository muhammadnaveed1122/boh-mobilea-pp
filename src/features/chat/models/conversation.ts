import type { Channel } from './channel';
import type { Message } from './message';

/** A contact row on the inbox screen. */
export interface ChatContact {
  id: string;
  name: string;
  /** Last message preview shown under the name. */
  lastMessage: string;
  /** Channel the last message arrived/was sent on. */
  lastChannel: Channel;
  /** Pre-formatted display time of the last message. */
  lastTime: string;
  /** Unread count — `0` hides the badge. */
  unread: number;
  /** Customer phone, when the conversation has one. Drives saved-contact name resolution. */
  phone?: string;
  /** Absolute ISO expiry of the 24h WhatsApp window; null when no inbound yet. */
  windowExpiresAt: string | null;
}

/** Full thread for the conversation screen. */
export interface Conversation {
  contact: ChatContact;
  /** Header subtitle, e.g. "All messages in one thread". */
  subtitle: string;
  messages: Message[];
}
