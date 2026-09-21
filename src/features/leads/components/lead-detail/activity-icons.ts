/**
 * Activity-type → lucide icon + label + colour maps for the Activity Log tab.
 *
 * Ported in full from web `boh-lead-magnet/src/features/leads/constants/activityTimeline.ts`
 * (`ACTIVITY_ICON_MAP` + `ACTIVITY_LABEL_MAP` + `ACTIVITY_STYLE_MAP`). Web uses
 * Phosphor icons + Tailwind colour classes; mobile uses lucide-react-native via
 * the shared `<Icon />` atom (which takes a colour *value*, not a class), so the
 * style map carries a Tailwind bg class (NativeWind resolves the default palette
 * — `theme.extend.colors` keeps it) plus a hex icon colour.
 */

import type { IconName } from '@/components/atoms/Icon';

import type { LeadActionType } from '../../models/lead-activity';

export const ACTIVITY_ICON_MAP: Record<LeadActionType, IconName> = {
  created: 'Clock',
  updated: 'Pencil',
  assigned: 'UserPlus',
  status_changed: 'ArrowLeftRight',
  viewed: 'Eye',
  notes_added: 'StickyNote',
  priority_changed: 'Flag',
  qualification_updated: 'ListChecks',
  listing_linked: 'Link',
  listing_unlinked: 'Unlink',
  project_linked: 'Building',
  project_unlinked: 'Building',
  agent_reassigned: 'ArrowLeftRight',
  agent_unassigned: 'UserMinus',
  sms_sent: 'MessageSquare',
  whatsapp_sent: 'MessageCircle',
  whatsapp_received: 'MessageCircle',
  email_sent: 'Mail',
  identity_document_uploaded: 'FileText',
  identity_verified: 'FileCheck',
  identity_note_added: 'StickyNote',
  identity_verification_link_generated: 'Link',
  identity_verification_link_shared: 'Share2',
  identity_verified_external: 'ShieldCheck',
  call_logged: 'Phone',
  ownership_document_uploaded: 'FileText',
  ownership_verified: 'ShieldCheck',
  ownership_rejected: 'ShieldX',
  contract_a_dld_redirect: 'ExternalLink',
  contract_a_uploaded: 'Upload',
  contract_a_replaced: 'Upload',
  noc_uploaded: 'Upload',
  noc_replaced: 'Upload',
  general_document_uploaded: 'Upload',
  general_document_replaced: 'Upload',
  property_finder_imported: 'Download',
  property_finder_merged: 'GitMerge',
};

export const ACTIVITY_LABEL_MAP: Record<LeadActionType, string> = {
  created: 'Lead Created',
  updated: 'Lead Updated',
  assigned: 'Agent Assigned',
  status_changed: 'Status Changed',
  viewed: 'Lead Viewed',
  notes_added: 'Note Added',
  priority_changed: 'Priority Changed',
  qualification_updated: 'Qualification Updated',
  listing_linked: 'Listing Linked',
  listing_unlinked: 'Listing Unlinked',
  project_linked: 'Project Linked',
  project_unlinked: 'Project Unlinked',
  agent_reassigned: 'Agent Reassigned',
  agent_unassigned: 'Agent Unassigned',
  sms_sent: 'SMS Sent',
  whatsapp_sent: 'WhatsApp Sent',
  whatsapp_received: 'WhatsApp Received',
  email_sent: 'Email Sent',
  identity_document_uploaded: 'Emirates ID / Passport Uploaded',
  identity_verified: 'Identity Verified',
  identity_note_added: 'Identity Note Added',
  identity_verification_link_generated: 'Verification Link Generated',
  identity_verification_link_shared: 'Verification Link Shared',
  identity_verified_external: 'Identity Verified (External)',
  call_logged: 'Call Logged',
  ownership_document_uploaded: 'Ownership Document Uploaded',
  ownership_verified: 'Ownership Verified',
  ownership_rejected: 'Ownership Verification Rejected',
  contract_a_dld_redirect: 'Contract A — DLD Redirect',
  contract_a_uploaded: 'Contract A Uploaded',
  contract_a_replaced: 'Contract A Replaced',
  noc_uploaded: 'NOC Uploaded',
  noc_replaced: 'NOC Replaced',
  general_document_uploaded: 'Documents Uploaded',
  general_document_replaced: 'Documents Replaced',
  property_finder_imported: 'Imported from PropertyFinder',
  property_finder_merged: 'Merged from PropertyFinder',
};

export interface ActivityStyle {
  /** Tailwind bg class for the icon badge circle (default palette). */
  bg: string;
  /** Hex icon colour passed to the lucide `<Icon color>` prop. */
  icon: string;
}

/**
 * Tailwind `-100` bg class + matching `-500/-600` hex icon colour per palette
 * name (the `<Icon>` atom takes a colour value, not a class). Mirrors web
 * `ACTIVITY_STYLE_MAP`'s colour pairs.
 */
const PALETTE = {
  emerald: { bg: 'bg-emerald-100', icon: '#059669' },
  blue: { bg: 'bg-blue-100', icon: '#2563eb' },
  violet: { bg: 'bg-violet-100', icon: '#7c3aed' },
  amber: { bg: 'bg-amber-100', icon: '#d97706' },
  gray: { bg: 'bg-gray-100', icon: '#6b7280' },
  sky: { bg: 'bg-sky-100', icon: '#0284c7' },
  orange: { bg: 'bg-orange-100', icon: '#ea580c' },
  teal: { bg: 'bg-teal-100', icon: '#0d9488' },
  indigo: { bg: 'bg-indigo-100', icon: '#4f46e5' },
  rose: { bg: 'bg-rose-100', icon: '#f43f5e' },
  cyan: { bg: 'bg-cyan-100', icon: '#0891b2' },
  green: { bg: 'bg-green-100', icon: '#16a34a' },
  slate: { bg: 'bg-slate-100', icon: '#475569' },
  roseDark: { bg: 'bg-rose-100', icon: '#e11d48' },
} as const satisfies Record<string, ActivityStyle>;

/** Per-type icon-badge colours, ported from web `ACTIVITY_STYLE_MAP`. */
export const ACTIVITY_STYLE_MAP: Record<LeadActionType, ActivityStyle> = {
  created: PALETTE.emerald,
  updated: PALETTE.blue,
  assigned: PALETTE.violet,
  status_changed: PALETTE.amber,
  viewed: PALETTE.gray,
  notes_added: PALETTE.sky,
  priority_changed: PALETTE.orange,
  qualification_updated: PALETTE.teal,
  listing_linked: PALETTE.indigo,
  listing_unlinked: PALETTE.rose,
  project_linked: PALETTE.indigo,
  project_unlinked: PALETTE.rose,
  agent_reassigned: PALETTE.violet,
  agent_unassigned: PALETTE.rose,
  sms_sent: PALETTE.cyan,
  whatsapp_sent: PALETTE.green,
  whatsapp_received: PALETTE.green,
  email_sent: PALETTE.blue,
  identity_document_uploaded: PALETTE.sky,
  identity_verified: PALETTE.emerald,
  identity_note_added: PALETTE.sky,
  identity_verification_link_generated: PALETTE.indigo,
  identity_verification_link_shared: PALETTE.green,
  identity_verified_external: PALETTE.emerald,
  call_logged: PALETTE.slate,
  ownership_document_uploaded: PALETTE.sky,
  ownership_verified: PALETTE.emerald,
  ownership_rejected: PALETTE.roseDark,
  contract_a_dld_redirect: PALETTE.violet,
  contract_a_uploaded: PALETTE.sky,
  contract_a_replaced: PALETTE.amber,
  noc_uploaded: PALETTE.teal,
  noc_replaced: PALETTE.amber,
  general_document_uploaded: PALETTE.indigo,
  general_document_replaced: PALETTE.amber,
  property_finder_imported: PALETTE.teal,
  property_finder_merged: PALETTE.violet,
};

const FALLBACK_STYLE: ActivityStyle = PALETTE.blue;

export function getActivityStyle(action: LeadActionType): ActivityStyle {
  return ACTIVITY_STYLE_MAP[action] ?? FALLBACK_STYLE;
}

/**
 * Filter chip set for the Activity Log tab — single-select subset of the most
 * common/useful activity types. Mirrors web's filterable actions, trimmed for a
 * mobile-friendly chip row (no date range on mobile v1).
 */
export const FILTERABLE_ACTIVITY_TYPES: readonly LeadActionType[] = [
  'created',
  'status_changed',
  'notes_added',
  'assigned',
  'email_sent',
  'sms_sent',
  'whatsapp_sent',
  'call_logged',
];
