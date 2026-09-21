import { apiClient } from '@/lib/api';

import type { Agent, AgentPresence, PaginatedAgents } from './types';

/**
 * Raw wire shapes. `GET /api/v1/agents` responds with the backend's
 * `PaginatedAgentsResponseDto` — `{ data: AgentResponseDto[], meta: {...} }` —
 * and the axios interceptor only unwraps the OUTER `{ success, data }`
 * envelope, so what lands here is `{ data, meta }`, NOT `{ items, ... }`.
 *
 * `AgentResponseDto` has no top-level name/email/avatar either: the person
 * lives under `user`, the picture under `photoUrl`, and `id` is the AGENT
 * PROFILE id (`userId` is the User id). Translate at this boundary and keep
 * the flat `Agent` shape for the UI.
 */
interface AgentApiUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface AgentApiItem {
  id: string;
  userId: string;
  user?: AgentApiUser | null;
  photoUrl?: string | null;
  isOnline: boolean;
}

interface AgentApiPage {
  data?: AgentApiItem[];
  meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
}

/** Map one `AgentResponseDto` onto the flat `Agent` the agents directory renders. */
function toAgent(dto: AgentApiItem): Agent {
  return {
    id: dto.id,
    userId: dto.userId,
    firstName: dto.user?.firstName ?? '',
    lastName: dto.user?.lastName ?? '',
    email: dto.user?.email ?? '',
    avatarUrl: dto.photoUrl ?? undefined,
    isOnline: dto.isOnline,
  };
}

export async function getAgents(params: {
  presence?: AgentPresence;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedAgents> {
  const { data: body } = await apiClient.get<AgentApiPage>('/api/v1/agents', {
    params: { isActive: true, limit: 20, ...params },
  });

  const items = (body?.data ?? []).map(toAgent);
  const page = body?.meta?.page ?? params.page ?? 1;

  return {
    items,
    total: body?.meta?.total ?? items.length,
    page,
    limit: body?.meta?.limit ?? params.limit ?? items.length,
    totalPages: body?.meta?.totalPages ?? page,
  };
}
