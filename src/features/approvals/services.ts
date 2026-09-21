/**
 * Approvals data access. Hits the same NestJS endpoints the web app uses:
 *   GET  /api/v1/approvals/{queue}                 (paginated + per-tab counts)
 *   GET  /api/v1/approvals/request/{id}
 *   POST /api/v1/approvals/request/{id}/approve
 *   POST /api/v1/approvals/request/{id}/request-changes
 *   GET  /api/v1/approvals/pending-count
 *   GET  /api/v1/users/approvers
 *   GET  /api/v1/agents?search=
 * The shared apiClient interceptor unwraps the {success,data} envelope, so the
 * resolved `data` is already the payload.
 */
import { apiClient } from '@/lib/api';

import type {
  ApprovalQueueParams,
  ApprovalQueueResponse,
  ApprovalRequestDetail,
  ResourceApprovalStatus,
} from './models/approval';

export interface ApproverOption {
  readonly value: string;
  readonly label: string;
}

function buildQueueParams(params: ApprovalQueueParams): Record<string, string | number> {
  const q: Record<string, string | number> = {
    page: params.page ?? 1,
    limit: params.limit ?? 10,
  };
  if (params.status) q.status = params.status;
  if (params.search && params.search.trim() !== '') q.search = params.search.trim();
  if (params.approverId && params.approverId !== '') q.approverId = params.approverId;
  if (params.agentId && params.agentId !== '') q.agentId = params.agentId;
  return q;
}

export async function getApprovalQueue(
  params: ApprovalQueueParams,
): Promise<ApprovalQueueResponse> {
  const { data } = await apiClient.get<ApprovalQueueResponse>(`/api/v1/approvals/${params.queue}`, {
    params: buildQueueParams(params),
  });
  const body = (data ?? {}) as Partial<ApprovalQueueResponse>;
  return {
    items: body.items ?? [],
    total: body.total ?? 0,
    page: body.page ?? 1,
    limit: body.limit ?? 10,
    totalPages: body.totalPages ?? 1,
    counts: body.counts ?? { pending: 0, approved: 0, changes_requested: 0 },
  };
}

export async function getApprovalRequest(id: string): Promise<ApprovalRequestDetail> {
  const { data } = await apiClient.get<ApprovalRequestDetail>(`/api/v1/approvals/request/${id}`);
  return {
    ...data,
    steps: data?.steps ?? [],
    history: data?.history ?? [],
    canAct: data?.canAct ?? false,
  };
}

export async function approveRequest(id: string, note?: string): Promise<ApprovalRequestDetail> {
  const { data } = await apiClient.post<ApprovalRequestDetail>(
    `/api/v1/approvals/request/${id}/approve`,
    { note },
  );
  return data;
}

export async function requestChangesRequest(
  id: string,
  note: string,
): Promise<ApprovalRequestDetail> {
  const { data } = await apiClient.post<ApprovalRequestDetail>(
    `/api/v1/approvals/request/${id}/request-changes`,
    { note },
  );
  return data;
}

export async function getApprovalsPendingCount(): Promise<{
  count: number;
  byCategory: Record<string, number>;
}> {
  const { data } = await apiClient.get<{ count?: number; byCategory?: Record<string, number> }>(
    '/api/v1/approvals/pending-count',
  );
  return { count: data?.count ?? 0, byCategory: data?.byCategory ?? {} };
}

/** Map an unknown user record to a picker option. */
function toApproverOption(raw: unknown): ApproverOption | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  if (id === '') return null;
  const first = typeof r.firstName === 'string' ? r.firstName : '';
  const last = typeof r.lastName === 'string' ? r.lastName : '';
  const name =
    typeof r.name === 'string' && r.name.trim() !== ''
      ? r.name
      : `${first} ${last}`.trim() || (typeof r.email === 'string' ? r.email : id);
  return { value: id, label: name };
}

export async function getApprovers(): Promise<ApproverOption[]> {
  const { data } = await apiClient.get<unknown>('/api/v1/users/approvers');
  const list = Array.isArray(data) ? data : ((data as { items?: unknown[] })?.items ?? []);
  return list.map(toApproverOption).filter((o): o is ApproverOption => o !== null);
}

export async function searchAgents(search: string): Promise<ApproverOption[]> {
  const { data } = await apiClient.get<{ items?: unknown[] }>('/api/v1/agents', {
    params: { isActive: true, limit: 50, ...(search.trim() ? { search: search.trim() } : {}) },
  });
  const list = Array.isArray(data) ? data : (data?.items ?? []);
  return list.map(toApproverOption).filter((o): o is ApproverOption => o !== null);
}

export async function getResourceApprovalStatus(params: {
  resourceType: string;
  resourceId: string;
}): Promise<ResourceApprovalStatus> {
  const { data } = await apiClient.get<Partial<ResourceApprovalStatus>>(
    '/api/v1/approvals/resource-status',
    { params: { resourceType: params.resourceType, resourceId: params.resourceId } },
  );
  return {
    hasPendingRequest: data?.hasPendingRequest ?? false,
    requestId: data?.requestId ?? null,
    category: data?.category ?? null,
    canDecide: data?.canDecide ?? false,
  };
}

export async function acknowledgeRequest(params: {
  resourceType: string;
  resourceId: string;
  note?: string;
}): Promise<{ requestId: string } | null> {
  const { data } = await apiClient.post<{ requestId: string } | null>(
    '/api/v1/approvals/acknowledge',
    params,
  );
  return data ?? null;
}
