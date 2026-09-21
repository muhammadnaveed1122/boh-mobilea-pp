import { PROPERTY_WHATSAPP_NUMBER } from '../constants';

/**
 * Optional listing details woven into the pre-filled enquiry.
 * Mirrors web `InquiryDetails` (boh-lead-magnet src/features/contact/constants).
 */
export interface InquiryDetails {
  /** Absolute public listing URL — included as "Property Link:" so the BE parser can link it. */
  propertyUrl?: string | null;
  /** Human listing reference (e.g. S-1042 / R-1042) — the preferred "Reference No." value. */
  reference?: string | null;
  /** Listing/opportunity id used as "Reference No." when there is no human reference. */
  fallbackId?: string | null;
}

/**
 * The pre-filled enquiry message sent from a listing Call/WhatsApp button.
 * FORMAT IS A CONTRACT with the backend parser (parse-enquiry-message.helper.ts) and must stay in
 * lockstep with web `buildInquiryMessage` — keep the `Property` / `Reference No.` / `Property Link`
 * lines and labels identical so an inbound message captures the lead and links the listing.
 */
export function buildInquiryMessage(propertyName: string, details?: InquiryDetails): string {
  const lines = [
    "Hi, I'm interested in this property and would like to get more details.",
    `Property: ${propertyName}`,
  ];
  const ref = details?.reference?.trim();
  const refValue = ref !== undefined && ref !== '' ? ref : (details?.fallbackId?.trim() ?? '');
  if (refValue !== '') {
    lines.push(`Reference No.: ${refValue}`);
  }
  const url = details?.propertyUrl?.trim();
  if (url !== undefined && url !== '') {
    lines.push(`Property Link: ${url}`);
  }
  lines.push('Looking forward to your response. Thank you!');
  return lines.join('\n');
}

/**
 * WhatsApp deep link with the pre-filled enquiry. Always the company line (never the assigned
 * agent's) — same as web, where every property enquiry lands in the company inbox.
 * WhatsApp only accepts digits, so the `+`/spacing is stripped.
 */
export function buildInquiryWhatsAppUrl(propertyName: string, details?: InquiryDetails): string {
  const digits = PROPERTY_WHATSAPP_NUMBER.replace(/[^\d]/g, '');
  const text = encodeURIComponent(buildInquiryMessage(propertyName, details));
  return `https://wa.me/${digits}?text=${text}`;
}
