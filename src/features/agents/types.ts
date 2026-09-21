/**
 * UI-facing agent shape. The backend's `AgentResponseDto` is nested
 * (`user.firstName`, `photoUrl`, `{ data, meta }` pagination) — `services.ts`
 * flattens it at the boundary so components stay simple.
 */
export interface Agent {
  /** Agent PROFILE id (`AgentResponseDto.id`). */
  id: string;
  /** Owning User id (`AgentResponseDto.userId`) — the id leads are assigned to. */
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  isOnline: boolean;
}

export interface PaginatedAgents {
  items: Agent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type AgentPresence = 'online' | 'offline';
