import { apiClient } from '@/lib/api';

export interface CreateLeadBody {
  leadType: string;
  name: string;
  email: string;
  phone: string;
  interest?: string;
  propertyType?: string;
  interestType?: string[];
  projectIds?: string[];
  projectSlug?: string;
  channel?: string;
  channelMeta?: Record<string, unknown>;
  additionalNotes?: string;
  specifyInterest?: string;
}

export const LEAD_CHANNEL_MOBILE = 'mobile_app';
export const ENTRY_POINT_PROJECT_DETAIL = 'project_detail_cta';
export const ENTRY_POINT_BROCHURE = 'project_detail_brochure';

export interface LeadResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  leadType: string;
}

export async function createLead(body: CreateLeadBody): Promise<LeadResponse> {
  const { data } = await apiClient.post<LeadResponse>('/api/v1/leads', body);
  return data;
}

export interface BrochureDownloadResponse {
  fileUrl: string;
}

export async function downloadBrochure(body: CreateLeadBody): Promise<BrochureDownloadResponse> {
  const { data } = await apiClient.post<BrochureDownloadResponse>(
    '/api/v1/leads/download-brochure',
    body,
  );
  return data;
}
