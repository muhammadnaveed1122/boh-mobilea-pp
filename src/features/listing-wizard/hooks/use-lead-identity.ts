import { useQuery } from '@tanstack/react-query';

import { getLeadDetail, getLeadDocuments, type LeadDocument } from '../services';

export interface LeadContact {
  phone: string | null;
  email: string | null;
}

/**
 * Hydration source for the identity section: the owner's latest EMIRATES_ID document (drives
 * verified/pending state + method) and the owner's contact (for link sharing). Re-query via
 * `refetch` after mutations or on demand — external verification is not pushed live.
 */
export function useLeadIdentity(leadId: string) {
  const docsQuery = useQuery({
    queryKey: ['lead-documents', leadId],
    queryFn: () => getLeadDocuments(leadId),
    enabled: leadId !== '',
  });
  const detailQuery = useQuery({
    queryKey: ['lead-detail', leadId],
    queryFn: () => getLeadDetail(leadId),
    enabled: leadId !== '',
  });

  const docs = docsQuery.data ?? [];
  const latestDoc =
    docs
      .filter((d) => d.documentType === 'EMIRATES_ID')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] ?? null;

  const contact: LeadContact = {
    phone: detailQuery.data?.phone ?? null,
    email: detailQuery.data?.email ?? null,
  };

  const refetch = async (): Promise<void> => {
    await docsQuery.refetch();
  };

  return {
    latestDoc: latestDoc as LeadDocument | null,
    contact,
    isLoading: docsQuery.isLoading,
    refetch,
  };
}
