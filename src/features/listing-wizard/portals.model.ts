import type { WizardMediaItem } from './media/types';

/**
 * Step 4 "Portals" client state — mirrors the web wizard (Step5Publish + the "Our Website
 * Content" block). Kept as plain React state in CreateListingWizard, matching how the earlier
 * steps carry `content`. See boh-lead-magnet `models/wizard.ts` + `propertyWorkflow.ts`.
 */

/** Trakheesi permit — DLD compliance details, required before a listing goes live. */
export interface WizardPermit {
  /** Backend permit status; 'not_applied' until a full permit is entered. */
  status: string;
  permitNumber: string;
  /** Public Trakheesi/DLD URL (maps to the CMS `permitDocumentUrl`). */
  permitUrl: string;
  applicationDate: string;
  approvalDate: string;
  expiryDate: string;
  rejectedDate: string;
  rejectionReason: string;
  notes: string;
  /** Single QR image; uploaded to blob storage then sent as `qrCodeUrl`. */
  qrCode: WizardMediaItem | null;
}

/** Portal destinations + Property Finder push config. */
export interface WizardPublish {
  /** Publish to our own website; on by default (gates the website-content block). */
  publishToPortal: boolean;
  pushToPropertyFinder: boolean;
  /** Property Finder agent (user) id — string in the picker, sent as a number. */
  pfAgentId: string | null;
  /** Property Finder location id — chosen on the Information step. */
  pfLocationId: string | null;
  pfPriceHidden: boolean;
  pfPublishAsDraft: boolean;
  permit: WizardPermit;
}

/** Website-only content shown under the "Our website" toggle. */
export interface WizardLocationConnectivity {
  heading: string;
  subtitle: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
}

export interface WizardSeo {
  metaTitle: string;
  urlSlug: string;
  metaDescription: string;
}

export interface WizardWebsiteContent {
  /** Website hero subtitle (sections.hero.subtitle). */
  subtitle: string;
  aboutTitle: string;
  aboutSubtitle: string;
  textSection1: string;
  textSection2: string;
  additionalDescription: string;
  highlightsTitle: string;
  highlightsSubtitle: string;
  location: WizardLocationConnectivity;
  seo: WizardSeo;
}

export const EMPTY_PERMIT: WizardPermit = {
  status: 'not_applied',
  permitNumber: '',
  permitUrl: '',
  applicationDate: '',
  approvalDate: '',
  expiryDate: '',
  rejectedDate: '',
  rejectionReason: '',
  notes: '',
  qrCode: null,
};

export const EMPTY_PUBLISH: WizardPublish = {
  publishToPortal: true,
  pushToPropertyFinder: false,
  pfAgentId: null,
  pfLocationId: null,
  pfPriceHidden: false,
  pfPublishAsDraft: false,
  permit: EMPTY_PERMIT,
};

export const EMPTY_WEBSITE_CONTENT: WizardWebsiteContent = {
  subtitle: '',
  aboutTitle: '',
  aboutSubtitle: '',
  textSection1: '',
  textSection2: '',
  additionalDescription: '',
  highlightsTitle: '',
  highlightsSubtitle: '',
  location: { heading: '', subtitle: '', locationName: '', latitude: null, longitude: null },
  seo: { metaTitle: '', urlSlug: '', metaDescription: '' },
};

/** Lowercase, hyphenated, ASCII-only slug — mirrors the web `slugifyUrlSlug`. */
export function slugifyUrlSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** A permit is only saved once the user has entered something. */
export function hasPermitData(permit: WizardPermit): boolean {
  return (
    permit.permitNumber.trim() !== '' ||
    permit.permitUrl.trim() !== '' ||
    permit.applicationDate.trim() !== '' ||
    permit.expiryDate.trim() !== '' ||
    permit.qrCode !== null
  );
}

/** A permit is "complete" (→ status 'approved') when number + both dates are present. */
export function isPermitComplete(permit: WizardPermit): boolean {
  return (
    permit.permitNumber.trim() !== '' &&
    permit.applicationDate.trim() !== '' &&
    permit.expiryDate.trim() !== ''
  );
}
