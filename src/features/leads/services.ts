import { apiClient } from '@/lib/api';
import { decryptContactsInJson, decryptLeadContact } from '@/lib/contact-encryption';
import type { LeadActivity, LeadActivityPage, LeadActivityQuery } from './models/lead-activity';
import type { LeadDetail, UpdateLeadPayload } from './models/lead-detail';
import type { LocationItem, LocationListParams } from './models/location';
import type {
  AgentsQuery,
  CreateLeadPayload,
  CreateViewingPayload,
  LeadCreator,
  LeadFunnelStats,
  LeadListItem,
  LeadNote,
  LeadsOverview,
  LeadsQuery,
  LeadViewing,
  OverviewQuery,
  PaginatedAgents,
  PaginatedLeads,
  PortalOverview,
  PortalOverviewQuery,
} from './types';

export async function getLeads(params: LeadsQuery): Promise<PaginatedLeads> {
  const { data } = await apiClient.get<PaginatedLeads>('/api/v1/leads', { params });
  return {
    ...data,
    items: data.items.map((item) => decryptLeadContact(item)),
  };
}

export async function getLeadFunnelStats(): Promise<LeadFunnelStats> {
  const { data } = await apiClient.get<LeadFunnelStats>('/api/v1/leads/funnel-stats');
  return data;
}

export async function createLead(payload: CreateLeadPayload): Promise<LeadListItem> {
  const { data } = await apiClient.post<LeadListItem>('/api/v1/leads', payload);
  return decryptLeadContact(data);
}

/**
 * Seed the flat `stateId` / `neighbourhoodId` mirrors from the nested
 * `state` / `neighbourhood` objects the backend returns on read. The edit
 * form binds to these flat ids and sends them in the PATCH payload; seeding
 * here keeps dirty tracking comparing against the real saved value (see
 * `LeadDetail.stateId`).
 */
function withLocationIds(lead: LeadDetail): LeadDetail {
  return {
    ...lead,
    stateId: lead.stateId ?? lead.state?.id,
    neighbourhoodId: lead.neighbourhoodId ?? lead.neighbourhood?.id,
  };
}

interface PaginatedLeadDetail {
  items?: LeadDetail[];
}

function isPaginatedResponse(value: unknown): value is PaginatedLeadDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as PaginatedLeadDetail).items)
  );
}

export async function getLeadById(id: string): Promise<LeadDetail> {
  const { data } = await apiClient.get<LeadDetail | PaginatedLeadDetail>('/api/v1/leads', {
    params: { id },
  });
  const lead = isPaginatedResponse(data) ? data.items?.[0] : data;
  if (!lead || typeof lead !== 'object' || !('id' in lead)) {
    throw new Error('Lead not found');
  }
  return withLocationIds(decryptLeadContact(lead));
}

export async function updateLead(
  id: string,
  payload: Partial<UpdateLeadPayload>,
): Promise<LeadDetail> {
  const { data } = await apiClient.patch<LeadDetail>(`/api/v1/leads/${id}`, payload);
  return withLocationIds(decryptLeadContact(data));
}

/** Raw location row from the backend (`{ id, name, slug }`). */
interface LocationApiRow {
  id: string;
  name: string;
}

function normalizeLocationList(data: unknown): LocationItem[] {
  let rows: LocationApiRow[];
  if (Array.isArray(data)) {
    rows = data as LocationApiRow[];
  } else {
    rows = (data as { items?: LocationApiRow[] })?.items ?? [];
  }
  return rows
    .filter((r) => typeof r?.id === 'string' && typeof r?.name === 'string')
    .map((r) => ({ id: r.id, name: r.name }));
}

/**
 * States (emirates) for the City select. Mirrors web's
 * `GET /locations/states` (web uses paginated search; the practical set is
 * small so mobile fetches a single page and filters client-side).
 */
export async function getStates(params: LocationListParams = {}): Promise<LocationItem[]> {
  const { data } = await apiClient.get('/api/v1/locations/states', {
    params: { limit: 100, sortOrder: 'asc', ...(params.search ? { search: params.search } : {}) },
  });
  return normalizeLocationList(data);
}

/**
 * Neighbourhoods for the Area select, restricted to a state. Mirrors web's
 * `GET /locations/neighbourhoods?stateId=…`.
 */
export async function getNeighbourhoods(params: LocationListParams): Promise<LocationItem[]> {
  const { data } = await apiClient.get('/api/v1/locations/neighbourhoods', {
    params: {
      limit: 100,
      sortOrder: 'asc',
      ...(params.stateId ? { stateId: params.stateId } : {}),
      ...(params.search ? { search: params.search } : {}),
    },
  });
  return normalizeLocationList(data);
}

export async function getLeadActivities(
  leadId: string,
  params: LeadActivityQuery,
): Promise<LeadActivityPage> {
  const query: Record<string, string> = {};
  query.page = String(params.page ?? 1);
  query.limit = String(params.limit ?? 20);
  if (params.search) query.search = params.search;
  if (params.action && params.action.length > 0) query.action = params.action.join(',');
  if (params.dateFrom) query.dateFrom = params.dateFrom;
  if (params.dateTo) query.dateTo = params.dateTo;

  const { data } = await apiClient.get<LeadActivityPage>(`/api/v1/leads/${leadId}/activities`, {
    params: query,
  });

  // Contact fields inside activity blobs arrive encrypted (`enc:v1:…`) from the
  // backend's `encryptContactsInJson`. Decrypt here so the timeline renders real
  // values; RBAC masking then applies on the plaintext (web parity).
  return {
    ...data,
    items: data.items.map((item) => ({
      ...item,
      oldValue: decryptContactsInJson(item.oldValue) as LeadActivity['oldValue'],
      newValue: decryptContactsInJson(item.newValue) as LeadActivity['newValue'],
      metadata: decryptContactsInJson(item.metadata) as LeadActivity['metadata'],
    })),
  };
}

export async function getLeadsOverview(params: OverviewQuery): Promise<LeadsOverview> {
  const { data } = await apiClient.get<LeadsOverview>('/api/v1/leads/overview', { params });
  return data;
}

export async function getPortalOverview(params: PortalOverviewQuery): Promise<PortalOverview> {
  const { data } = await apiClient.get<PortalOverview>('/api/v1/leads/portal-overview', { params });
  return data;
}

/**
 * Wire shape of `GET /api/v1/agents` (backend `PaginatedAgentsResponseDto`):
 * `{ data: AgentResponseDto[], meta: { total, page, limit, totalPages } }`.
 * The axios interceptor unwraps only the outer `{ success, data }` envelope,
 * so this — not `{ items }` — is what arrives. `AgentResponseDto` nests the
 * person under `user` and the picture under `photoUrl`.
 */
interface AgentApiPage {
  data?: {
    id: string;
    userId: string;
    user?: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      teamName?: string | null;
      teamStatus?: string | null;
    } | null;
    photoUrl?: string | null;
  }[];
  meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
}

export async function getAgents(params: AgentsQuery): Promise<PaginatedAgents> {
  const { data: body } = await apiClient.get<AgentApiPage>('/api/v1/agents', {
    params: { isActive: true, limit: 50, ...params },
  });

  // `AgentListItem.id` is the USER id, not the agent-profile id: both consumers
  // feed it back as `assigneeId`, and the backend's AssignLeadDto / Lead.assignee
  // relation resolve that against `User`.
  const items = (body?.data ?? []).map((dto) => ({
    id: dto.userId,
    agentId: dto.id,
    firstName: dto.user?.firstName ?? null,
    lastName: dto.user?.lastName ?? null,
    email: dto.user?.email ?? null,
    avatarUrl: dto.photoUrl ?? null,
    teamName: dto.user?.teamName ?? null,
    isTeamDeactivated: dto.user?.teamStatus === 'deactivated',
  }));
  const page = body?.meta?.page ?? params.page ?? 1;

  return {
    items,
    total: body?.meta?.total ?? items.length,
    page,
    limit: body?.meta?.limit ?? params.limit ?? items.length,
    totalPages: body?.meta?.totalPages ?? page,
  };
}

/**
 * Users who hold `leads:create` — powers the "Created By" filter, same as web.
 * The route is authentication-gated (not `users:read`), so any leads user can
 * read it.
 */
export async function getLeadCreators(): Promise<LeadCreator[]> {
  const { data } = await apiClient.get<LeadCreator[]>('/api/v1/users/lead-creators');
  return Array.isArray(data) ? data : [];
}

export async function createLeadViewing(
  leadId: string,
  payload: CreateViewingPayload,
): Promise<LeadViewing> {
  const { data } = await apiClient.post<LeadViewing>(`/api/v1/leads/${leadId}/viewings`, payload);
  return data;
}

export async function getLeadNotes(leadId: string): Promise<LeadNote[]> {
  const { data } = await apiClient.get<LeadNote[]>(`/api/v1/leads/${leadId}/notes`);
  return data;
}

export async function createLeadNote(leadId: string, content: string): Promise<LeadNote> {
  const { data } = await apiClient.post<LeadNote>(`/api/v1/leads/${leadId}/notes`, { content });
  return data;
}

export async function updateLeadNote(
  leadId: string,
  noteId: string,
  content: string,
): Promise<LeadNote> {
  const { data } = await apiClient.patch<LeadNote>(`/api/v1/leads/${leadId}/notes/${noteId}`, {
    content,
  });
  return data;
}

export async function deleteLeadNote(leadId: string, noteId: string): Promise<void> {
  await apiClient.delete(`/api/v1/leads/${leadId}/notes/${noteId}`);
}
