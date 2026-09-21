import { useMutation } from '@tanstack/react-query';

import type { WizardDocItem, WizardMediaItem } from '../media/types';
import {
  getOpportunityListingMedia,
  getPrimaryListingMedia,
  upsertOpportunityListingAbout,
  upsertOpportunityListingHeroMedia,
  upsertOpportunityListingDocuments,
  upsertPrimaryListingAbout,
  upsertPrimaryListingHeroMedia,
} from '../services';
import type { WizardCreated } from './use-save-content';

export interface WizardContentInput {
  title: string;
  description: string;
  heroMedia: WizardMediaItem[];
  aboutImage1: WizardMediaItem | null;
  aboutImage2: WizardMediaItem | null;
  videoLink: string;
  view360Link: string;
  selectedAmenityIds: string[];
}

export interface SaveMediaArgs {
  created: WizardCreated;
  content: WizardContentInput;
  documents: WizardDocItem[];
  notes: string;
}

export interface SaveMediaResult {
  heroMedia: WizardMediaItem[];
  aboutImage1: WizardMediaItem | null;
  aboutImage2: WizardMediaItem | null;
}

/**
 * Persists the Media step: upserts hero (with title/description carried from the Description
 * step) + about images, uploads supporting documents (secondary), then re-seeds media from a
 * content GET so a re-save sends kept items via existingMedia (idempotent, no duplicates).
 */
export function useSaveMedia() {
  return useMutation<SaveMediaResult, Error, SaveMediaArgs>({
    mutationFn: async ({ created, content, documents, notes }) => {
      if (created.listingId === undefined) {
        throw new Error('Save the earlier steps first.');
      }
      const heroFields = {
        title: content.title,
        description: content.description,
        videoLink: content.videoLink,
        view360Link: content.view360Link,
        media: content.heroMedia,
      };
      const aboutFields = { image1: content.aboutImage1, image2: content.aboutImage2 };

      if (created.branch === 'primary') {
        await upsertPrimaryListingHeroMedia(created.listingId, heroFields);
        await upsertPrimaryListingAbout(created.listingId, aboutFields);
        const media = await getPrimaryListingMedia(created.listingId);
        return { heroMedia: media.hero, aboutImage1: media.about1, aboutImage2: media.about2 };
      }

      // secondary
      await upsertOpportunityListingHeroMedia(created.listingId, heroFields);
      await upsertOpportunityListingAbout(created.listingId, aboutFields);
      if (created.opportunityId !== undefined) {
        for (const doc of documents.filter((d) => d.uri !== '')) {
          await upsertOpportunityListingDocuments(created.opportunityId, doc, notes);
        }
      }
      const media = await getOpportunityListingMedia(created.listingId);
      return { heroMedia: media.hero, aboutImage1: media.about1, aboutImage2: media.about2 };
    },
  });
}
