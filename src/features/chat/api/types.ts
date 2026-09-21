/** Backend message direction. */
export type ApiMessageDirection = 'inbound' | 'outbound';

/** Backend delivery status. */
export type ApiMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** The user who sent an outbound message, attached by the backend as `senderInfo`. */
export interface ApiSenderInfo {
  id: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

/** A message row as returned by the chat API (`MessageResource`). */
export interface ApiMessage {
  id: string;
  conversationId: string;
  channel?: string | null;
  direction: ApiMessageDirection;
  /** Present on outbound messages — the agent/user who sent it. */
  senderInfo?: ApiSenderInfo | null;
  type?: string | null;
  content?: string | null;
  mediaUrl?: string | null;
  mediaId?: string | null;
  caption?: string | null;
  metadata?: Record<string, unknown> | null;
  status?: ApiMessageStatus | null;
  createdAt: string;
  /** Reaction aggregates attached by the backend (per emoji, per viewer). */
  reactions?: { emoji: string; count: number; mine: boolean }[] | null;
}

/** An enriched conversation row from `GET /chat/conversations`. */
export interface ApiConversation {
  id: string;
  channel?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  leadId?: string | null;
  agentId?: string | null;
  status?: string | null;
  unreadCount?: number | null;
  latestMessage?: ApiMessage | null;
  lastMessageAt?: string | null;
  /**
   * Absolute ISO expiry of the 24h WhatsApp window (last inbound + 24h), or
   * null when the customer has never replied. Computed per row by the backend
   * on the LIST response, so the inbox needs no per-conversation request.
   */
  windowExpiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Body for `POST /chat/send` (unified channel). The backend resolves the
 * target conversation from `to` (WhatsApp) or `leadId` (email/unified), so
 * `conversationId` is intentionally NOT sent — the unified DTO rejects
 * unknown fields.
 */
export interface SendMessageInput {
  channel: 'unified';
  to?: string;
  leadId?: string;
  content?: string;
  subject?: string;
  caption?: string;
  /** Media kind: image | video | document. */
  type?: string;
  filename?: string;
  /** React-Native multipart file descriptor. */
  file?: { uri: string; name: string; type: string };
  /** ID of the parent chat message this send is quoting. */
  replyToMessageId?: string;
  /** Outbound WhatsApp location. Backend dispatches a location message when
   *  latitude & longitude are both present and non-zero. */
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
}

/**
 * The chat API returns lists in several shapes depending on endpoint and the
 * envelope-unwrapping interceptor. Normalize to a plain array.
 */
export function extractRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return obj.rows as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.rows)) return inner.rows as T[];
      if (Array.isArray(inner.items)) return inner.items as T[];
    }
  }
  return [];
}

/**
 * A dedicated WhatsApp number (DID) assigned to the current agent, from
 * `GET /chat/whatsapp/my-numbers`. An empty list means a shared-number agent.
 */
export interface MyWhatsappNumber {
  /** E.164 DID, e.g. `+9715XXXXXXX`. */
  number: string;
  /** Meta's phone_number_id — the `businessPhoneNumberId` for outbound sends. */
  phoneNumberId: string;
}

/**
 * One component of a Meta template definition. Only the header's `format`
 * matters here — it is what marks a template as needing an image.
 */
export interface ApiWhatsappTemplateComponent {
  type?: string | null;
  format?: string | null;
}

/** A WhatsApp template row from `GET /chat/whatsapp/templates`. */
export interface ApiWhatsappTemplate {
  id: string;
  name: string;
  language: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  category?: string | null;
  body?: string | null;
  headerType?: string | null;
  /** Meta's raw component definitions; the authoritative header description. */
  components?: ApiWhatsappTemplateComponent[] | null;
  headerText?: string | null;
  footer?: string | null;
  placeholdersCount?: number | null;
}

/**
 * Template send params. Mapped onto the unified `POST /chat/send` body
 * (`channel: 'whatsapp'`, `languageCode` → `templateLanguage`) in `services.ts`
 * — the dedicated template route is superadmin-gated. See `sendWhatsappTemplate`.
 */
export interface SendTemplateInput {
  to: string;
  templateName: string;
  languageCode: string;
  parameters?: string[];
  leadId?: string;
}

/**
 * Body for `POST /chat/whatsapp/messages` — the "start a chat with this
 * number" path. Unlike the unified `/chat/send`, this resolves (or creates)
 * the conversation from a raw phone number, so it works for a number the CRM
 * has never seen.
 *
 * Send `content` alone first: the backend decides server-side whether the 24h
 * window is open. If it is closed it rejects with `SELECT_TEMPLATE_FIRST`, and
 * the caller retries with `templateName` + `templateLanguage` instead.
 */
export interface StartWhatsappChatInput {
  /** Recipient in E.164, e.g. `+9715XXXXXXX`. */
  to: string;
  /** Free text. Omitted when sending a template. */
  content?: string;
  templateName?: string;
  templateLanguage?: string;
  /**
   * Image for a media-header template (the listing card). Must be publicly
   * fetchable — Meta pulls it server-side and rejects the send otherwise.
   */
  templateHeaderImageUrl?: string;
}

/**
 * `POST /chat/whatsapp/messages` returns the created ChatMessage. Only the
 * conversation id matters here — it is what the caller navigates to, and the
 * backend's `findOrCreate` means an existing thread for that number comes back
 * rather than a duplicate.
 */
export interface StartWhatsappChatResult {
  conversationId: string;
}

/**
 * Body for `POST /chat/send` email. `channel: 'unified'` + a `subject` routes
 * to the email path; the backend resolves the lead's conversation from
 * `leadId`, so no `conversationId` is required.
 */
export interface SendLeadEmailInput {
  channel: 'unified';
  leadId: string;
  subject: string;
  content: string;
}

/**
 * Body for `POST /chat/messenger/messages` (text reply within an existing
 * Messenger conversation). The backend resolves the recipient PSID from the
 * conversation, so only `conversationId` + `content` are sent.
 */
export interface SendMessengerInput {
  conversationId: string;
  content: string;
}

/**
 * Multipart body for `POST /chat/messenger/messages/media`. `conversationId`
 * is sent as a form field alongside the React-Native file descriptor.
 */
export interface SendMessengerMediaInput {
  conversationId: string;
  file: { uri: string; name: string; type: string };
}
