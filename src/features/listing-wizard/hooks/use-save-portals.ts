import { useMutation } from '@tanstack/react-query';

import {
  hasPermitData,
  isPermitComplete,
  type WizardPublish,
  type WizardWebsiteContent,
} from '../portals.model';
import {
  persistOpportunityWizardState,
  persistPrimaryWizardState,
  uploadToBlobStorage,
  upsertOpportunityListingAboutText,
  upsertOpportunityListingHeroContent,
  upsertOpportunityListingHighlights,
  upsertOpportunityListingLocation,
  upsertOpportunityListingPermit,
  upsertOpportunityListingSeo,
  upsertPrimaryListingAboutText,
  upsertPrimaryListingHeroContent,
  upsertPrimaryListingHighlights,
  upsertPrimaryListingLocation,
  upsertPrimaryListingPermit,
  upsertPrimaryListingSeo,
  type HeroContentFields,
  type PermitFields,
  type WizardStatePortals,
} from '../services';
import type { WizardContentInput } from './use-save-media';
import type { WizardCreated } from './use-save-content';

export interface SavePortalsArgs {
  created: WizardCreated;
  publish: WizardPublish;
  website: WizardWebsiteContent;
  /** Carried from earlier steps so the hero re-save (for the subtitle) preserves title/desc/media. */
  content: WizardContentInput;
  selectedAmenityIds: string[];
}

const num = (v: string | null): number | null => (v === null || v === '' ? null : Number(v));

/** Resolve the permit's QR public URL (upload a freshly-picked image first), then a save body. */
async function resolvePermitFields(publish: WizardPublish): Promise<PermitFields> {
  const { permit } = publish;
  let qrCodeUrl = permit.qrCode?.url;
  if (permit.qrCode?.uri !== undefined) {
    qrCodeUrl = await uploadToBlobStorage(
      { uri: permit.qrCode.uri, name: permit.qrCode.name, mimeType: permit.qrCode.mimeType },
      'trakheesi-permits',
    );
  }
  return {
    status: permit.status,
    permitNumber: permit.permitNumber.trim(),
    permitUrl: permit.permitUrl.trim(),
    applicationDate: permit.applicationDate,
    expiryDate: permit.expiryDate,
    qrCodeAltText: permit.qrCode?.altText ?? '',
    qrCodeUrl,
    complete: isPermitComplete(permit),
  };
}

/**
 * Persists the Portals step, matching the web wizard's `finish` sequence: amenities are already
 * saved by useSaveAmenities; here we save the website-content sections (hero subtitle, about
 * text, highlights, location, SEO), the Trakheesi permit (when entered), and the wizard-state
 * (portal toggles + PF config). Primary uses the single `/listing-cms?section=` upsert; secondary
 * uses the per-section opportunity-listing endpoints.
 */
export function useSavePortals() {
  return useMutation<void, Error, SavePortalsArgs>({
    mutationFn: async ({ created, publish, website, content }) => {
      const listingId = created.listingId;
      if (listingId === undefined) {
        throw new Error('Save the earlier steps first.');
      }
      const isPrimary = created.branch === 'primary';

      const hero: HeroContentFields = {
        title: content.title,
        subtitle: website.subtitle,
        description: content.description,
        videoLink: content.videoLink,
        view360Link: content.view360Link,
        media: content.heroMedia,
      };
      const about = {
        title: website.aboutTitle,
        subtitle: website.aboutSubtitle,
        textSection1: website.textSection1,
        textSection2: website.textSection2,
        additionalDescription: website.additionalDescription,
      };
      const highlights = { title: website.highlightsTitle, subtitle: website.highlightsSubtitle };
      const { location, seo } = website;

      if (isPrimary) {
        await upsertPrimaryListingHeroContent(listingId, hero);
        await upsertPrimaryListingAboutText(listingId, about);
        await upsertPrimaryListingHighlights(listingId, highlights);
        await upsertPrimaryListingLocation(listingId, location);
        await upsertPrimaryListingSeo(listingId, seo);
      } else {
        await upsertOpportunityListingHeroContent(listingId, hero);
        await upsertOpportunityListingAboutText(listingId, about);
        await upsertOpportunityListingHighlights(listingId, highlights);
        await upsertOpportunityListingLocation(listingId, location);
        await upsertOpportunityListingSeo(listingId, seo);
      }

      if (hasPermitData(publish.permit)) {
        const permitFields = await resolvePermitFields(publish);
        if (isPrimary) await upsertPrimaryListingPermit(listingId, permitFields);
        else await upsertOpportunityListingPermit(listingId, permitFields);
      }

      const portals: WizardStatePortals = {
        publishToPortal: publish.publishToPortal,
        pushToPropertyFinder: publish.pushToPropertyFinder,
        pfAgentId: num(publish.pfAgentId),
        pfLocationId: num(publish.pfLocationId),
        pfPriceHidden: publish.pfPriceHidden,
        pfPublishAsDraft: publish.pfPublishAsDraft,
      };
      if (isPrimary) await persistPrimaryWizardState(listingId, portals);
      else await persistOpportunityWizardState(listingId, portals);
    },
  });
}
