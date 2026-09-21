import { apiClient } from '@/lib/api';
import type { Campaign } from './models/campaign';
import type { CallsListResponse } from './models/call-record';
import type { CallStats } from './models/call-stats';
import type { CallLogQuery } from './models/query';

const BASE = '/api/v1/call-service';

/** Drop empty / 'all' params (matches web buildQs). axios serializes the rest. */
function buildParams(q: CallLogQuery): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== 'all') out[k] = String(v);
  });
  return out;
}

export async function getCallRecords(q: CallLogQuery): Promise<CallsListResponse> {
  const { data } = await apiClient.get<CallsListResponse>(`${BASE}/calls`, {
    params: buildParams(q),
  });
  return data;
}

/**
 * Telesales campaigns — drives the Campaigns-tab filter and per-row campaign-name
 * resolution. Lives under a different base than call-service. Response envelope is
 * unwrapped by the axios interceptor to `{ data: Campaign[], meta }`.
 */
export async function getCampaigns(): Promise<Campaign[]> {
  const { data } = await apiClient.get<{ data?: Campaign[] }>('/api/v1/telesales/campaigns', {
    params: { limit: 100 },
  });
  return data.data ?? [];
}

export async function getCallStats(q: CallLogQuery): Promise<CallStats> {
  const { data } = await apiClient.get<CallStats>(`${BASE}/calls/stats`, {
    params: buildParams(q),
  });
  return data;
}

export async function checkDnc(phones: string[]): Promise<Record<string, boolean>> {
  const { data } = await apiClient.get<Record<string, boolean>>(`${BASE}/dnc/check`, {
    params: { phones: phones.join(',') },
  });
  return data;
}

export interface CallbackPayload {
  customerPhone: string;
  agentExtension: string;
  agentName?: string;
}

export async function initiateCallback(body: CallbackPayload): Promise<void> {
  await apiClient.post(`${BASE}/calls/callback`, body);
}

export async function addToDnc(body: { phone: string; note?: string }): Promise<void> {
  await apiClient.post(`${BASE}/dnc`, body);
}

export async function removeFromDnc(phone: string): Promise<void> {
  await apiClient.delete(`${BASE}/dnc/${encodeURIComponent(phone)}`);
}
