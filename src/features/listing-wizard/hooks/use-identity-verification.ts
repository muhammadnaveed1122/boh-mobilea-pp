import { useState } from 'react';

import type { WizardDocItem } from '../media/types';
import {
  generateLeadVerificationLink,
  shareLeadVerificationLink,
  type IdentityDoc,
  type VerificationProvider,
  updateLeadDocumentNotes,
  uploadLeadDocument,
  verifyLeadDocument,
} from '../services';

/**
 * Manual-review identity actions against the owner (lead). `uploadAndVerify` uploads the file
 * first when there is no `existingId` (returns the new doc), otherwise re-verifies the existing
 * doc (returns null). `isBusy` reflects any in-flight call so the UI can disable controls.
 */
export function useIdentityVerification() {
  const [isBusy, setIsBusy] = useState(false);

  const uploadAndVerify = async (args: {
    leadId: string;
    file: WizardDocItem;
    existingId?: string;
    status: 'VERIFIED' | 'REJECTED';
    notes: string;
  }): Promise<IdentityDoc | null> => {
    setIsBusy(true);
    try {
      if (args.existingId === undefined) {
        const doc = await uploadLeadDocument(
          args.leadId,
          args.file,
          args.notes === '' ? undefined : args.notes,
        );
        await verifyLeadDocument(args.leadId, doc.id, args.status);
        return doc;
      }
      await verifyLeadDocument(args.leadId, args.existingId, args.status);
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  const updateNotes = async (leadId: string, documentId: string, notes: string): Promise<void> => {
    setIsBusy(true);
    try {
      await updateLeadDocumentNotes(leadId, documentId, notes);
    } finally {
      setIsBusy(false);
    }
  };

  const generateLink = async (
    leadId: string,
    provider: VerificationProvider,
    reset?: boolean,
  ): Promise<{ id: string; url: string }> => {
    setIsBusy(true);
    try {
      return await generateLeadVerificationLink(leadId, provider, reset);
    } finally {
      setIsBusy(false);
    }
  };

  const shareLink = async (
    leadId: string,
    linkId: string,
    mode: 'WHATSAPP' | 'EMAIL',
  ): Promise<void> => {
    setIsBusy(true);
    try {
      await shareLeadVerificationLink(leadId, linkId, mode);
    } finally {
      setIsBusy(false);
    }
  };

  return { uploadAndVerify, updateNotes, generateLink, shareLink, isBusy };
}
