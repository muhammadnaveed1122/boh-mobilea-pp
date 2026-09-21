import type { LeadAssigneeRef } from './types';

/**
 * Display name for an assigned agent. The list endpoint sends `firstName`/`lastName`
 * (never a joined `name`), so fall back through the flattened `name`, then email,
 * then a generic label so a chip never renders empty.
 */
export function assigneeName(assignee: LeadAssigneeRef | null | undefined): string | null {
  if (!assignee) return null;
  const full = [assignee.firstName, assignee.lastName].filter(Boolean).join(' ').trim();
  return full || assignee.name?.trim() || assignee.email?.trim() || 'Agent';
}

/**
 * Agent photo. It may live on either the user profile or the agent profile — the
 * backend selects both (see `resolveAgentAvatarUrl`), so check both here too.
 */
export function assigneeAvatarUrl(assignee: LeadAssigneeRef | null | undefined): string | null {
  if (!assignee) return null;
  return (
    assignee.profile?.profilePicUrl || assignee.agentProfile?.photoUrl || assignee.avatarUrl || null
  );
}
