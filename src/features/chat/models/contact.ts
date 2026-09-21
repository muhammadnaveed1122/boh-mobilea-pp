/**
 * Agent phonebook + broadcast-group models. Mirrors the backend
 * `agent-contacts` module (see boh-lead-magnet-backend/src/modules/agent-contacts).
 *
 * The whole surface is dedicated-number only — the backend throws
 * `ForbiddenException` on every route when the caller has no active WhatsApp
 * number of their own, so shared-number agents get a 403 and the UI hides.
 */

/** A saved contact in the agent's personal phonebook. */
export interface AgentContact {
  id: string;
  name: string;
  /** E.164, e.g. `+9715XXXXXXX`. */
  phone: string;
  groupId: string | null;
  createdAt: string;
  group?: { id: string; name: string } | null;
}

/** A named broadcast group ("channel"). `contactCount` is flattened from `_count`. */
export interface ContactGroup {
  id: string;
  name: string;
  contactCount: number;
  createdAt: string;
}

/** One historical broadcast on a channel's feed. */
export interface ChannelBroadcast {
  id: string;
  templateName: string;
  content: string | null;
  headerImageUrl: string | null;
  total: number;
  sent: number;
  createdAt: string;
}

/** Per-recipient outcome of a template blast. */
export interface BroadcastResult {
  total: number;
  sent: number;
  failed: { phone: string; error: string }[];
}

/**
 * A property listing attached to a broadcast. The image is passed to the
 * backend as `headerImageUrl` and rides the template's IMAGE header component.
 */
export interface ListingCard {
  id: string;
  title: string;
  /** Publicly fetchable image URL — becomes the template's IMAGE header. */
  imageUrl: string;
  /** Pre-formatted price, e.g. "AED 1,250,000". Already localised upstream. */
  priceLabel: string;
  location: string;
}

export interface CreateContactInput {
  name: string;
  phone: string;
  groupId?: string;
}

export interface ImportContactsInput {
  contacts: { name: string; phone: string }[];
  groupId?: string;
}

/** Shared body for both the group blast and the ad-hoc multi-send. */
export interface BroadcastTemplateInput {
  templateName: string;
  templateLanguage?: string;
  /** Fills the template's `{{1}}` placeholder. */
  content?: string;
  /** Media-header image — set from the attached listing. */
  headerImageUrl?: string;
}

export interface SendMultiTemplateInput extends BroadcastTemplateInput {
  contactIds: string[];
}
