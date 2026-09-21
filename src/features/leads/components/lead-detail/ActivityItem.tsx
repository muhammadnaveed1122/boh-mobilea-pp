import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { initials } from '@/lib/format/initials';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import type { LeadActivity } from '../../models/lead-activity';
import type { BadgeTone } from '../../types';

import {
  buildFieldChanges,
  formatCallDuration,
  formatCallOutcome,
  formatClockTime,
  formatPriorityLabel,
  formatStatusLabel,
  getDisplayedPerformerRole,
  getMessageChannel,
  getMessageTypeLabel,
  getPerformerName,
  getPriorityTone,
  getStatusTone,
  type MessageChannel,
} from './activity-format';
import { ACTIVITY_ICON_MAP, ACTIVITY_LABEL_MAP, getActivityStyle } from './activity-icons';

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function AgentAvatar({
  name,
  role,
  className,
}: Readonly<{ name: string; role?: string; className?: string }>) {
  return (
    <View className={cn('min-w-0 flex-row items-center gap-2', className)}>
      <View className="h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Text className="text-[10px] font-semibold text-muted-foreground">{initials(name)}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
          {name}
        </Text>
        {role ? (
          <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
            {role}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const CHANNEL_TONE: Record<MessageChannel, BadgeTone> = {
  whatsapp: 'successSoft',
  sms: 'infoSoft',
  email: 'infoSoft',
};

const CHANNEL_LABEL: Record<MessageChannel, string> = {
  whatsapp: 'Whatsapp',
  sms: 'SMS',
  email: 'Email',
};

function ToneBadge({ tone, label }: Readonly<{ tone: BadgeTone; label: string }>) {
  return (
    <Badge variant={tone}>
      <Text>{label}</Text>
    </Badge>
  );
}

/** Boxed body text (notes, message previews) — `bg-muted` tinted block. */
function NoteBlock({ text }: Readonly<{ text: string }>) {
  return (
    <View className="rounded-lg bg-muted p-3">
      <Text className="text-xs text-muted-foreground">{text}</Text>
    </View>
  );
}

function CardTitle({ children }: Readonly<{ children: ReactNode }>) {
  return <Text className="text-sm font-semibold text-foreground">{children}</Text>;
}

function FieldChanges({
  activity,
  canViewContact,
}: Readonly<{ activity: LeadActivity; canViewContact: boolean }>) {
  const changes = buildFieldChanges(activity.oldValue, activity.newValue, canViewContact);
  if (changes.length === 0) return null;
  return (
    <View className="gap-1.5">
      {changes.map((change) => (
        <View key={change.field} className="flex-row flex-wrap items-start gap-1">
          <Text className="text-xs font-medium text-muted-foreground">{change.label}:</Text>
          <Text className="text-xs text-muted-foreground">{change.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Per-action cards (mirror web ActivityTimelineEntry)
// ---------------------------------------------------------------------------

function StatusChangedCard({ activity }: Readonly<{ activity: LeadActivity }>) {
  const meta = activity.metadata;
  const oldStatus = meta?.old_status ?? (activity.oldValue?.status as string | undefined);
  const newStatus = meta?.new_status ?? (activity.newValue?.status as string | undefined);
  const note = meta?.note;

  return (
    <View className="gap-2">
      <CardTitle>Status Changed</CardTitle>
      {oldStatus && newStatus ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-xs text-muted-foreground">from</Text>
          <ToneBadge tone={getStatusTone(oldStatus)} label={formatStatusLabel(oldStatus)} />
          <Text className="text-xs text-muted-foreground">to</Text>
          <ToneBadge tone={getStatusTone(newStatus)} label={formatStatusLabel(newStatus)} />
        </View>
      ) : null}
      <AgentAvatar
        name={getPerformerName(activity)}
        role={getDisplayedPerformerRole(activity, 'Agent')}
      />
      {note ? <NoteBlock text={note} /> : null}
    </View>
  );
}

function PriorityChangedCard({ activity }: Readonly<{ activity: LeadActivity }>) {
  const meta = activity.metadata;
  const oldPriority = meta?.old_priority ?? (activity.oldValue?.priority as string | undefined);
  const newPriority = meta?.new_priority ?? (activity.newValue?.priority as string | undefined);

  return (
    <View className="gap-2">
      <CardTitle>Priority Changed</CardTitle>
      {oldPriority && newPriority ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-xs text-muted-foreground">from</Text>
          <ToneBadge tone={getPriorityTone(oldPriority)} label={formatPriorityLabel(oldPriority)} />
          <Text className="text-xs text-muted-foreground">to</Text>
          <ToneBadge tone={getPriorityTone(newPriority)} label={formatPriorityLabel(newPriority)} />
        </View>
      ) : null}
      <AgentAvatar
        name={getPerformerName(activity)}
        role={getDisplayedPerformerRole(activity, 'Agent')}
      />
    </View>
  );
}

function AssignmentCard({ activity }: Readonly<{ activity: LeadActivity }>) {
  const arrowColor = useThemeColor('--muted-foreground');
  const meta = activity.metadata;
  const assigneeName = meta?.assignee_name;
  const previousName = meta?.previous_assignee_name;

  return (
    <View className="gap-2">
      <CardTitle>{ACTIVITY_LABEL_MAP[activity.action]}</CardTitle>
      {activity.action === 'agent_reassigned' && previousName && assigneeName ? (
        <View className="gap-1">
          <AgentAvatar name={previousName} role="Previous" />
          <View className="h-4 w-7 items-center justify-center">
            <Icon name="ArrowDown" size={12} color={arrowColor} />
          </View>
          <AgentAvatar name={assigneeName} role="Agent" />
        </View>
      ) : null}
      {activity.action === 'assigned' && assigneeName ? (
        <AgentAvatar name={assigneeName} role="Agent" />
      ) : null}
      {activity.action === 'agent_unassigned' && previousName ? (
        <AgentAvatar name={previousName} role="Removed" />
      ) : null}
    </View>
  );
}

function MessageCard({ activity }: Readonly<{ activity: LeadActivity }>) {
  const meta = activity.metadata;
  const preview = meta?.message_preview;
  const channel = getMessageChannel(activity.action);
  const senderRole = meta?.sender_role;
  const displayRole = senderRole === 'lead' ? 'Lead' : 'Agent';

  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1">
          <CardTitle>{getMessageTypeLabel(meta)}</CardTitle>
        </View>
        <View className="shrink-0">
          <ToneBadge tone={CHANNEL_TONE[channel]} label={CHANNEL_LABEL[channel]} />
        </View>
      </View>
      <AgentAvatar
        name={getPerformerName(activity)}
        role={getDisplayedPerformerRole(activity, displayRole)}
      />
      {preview ? <NoteBlock text={preview} /> : null}
    </View>
  );
}

function CallLoggedCard({ activity }: Readonly<{ activity: LeadActivity }>) {
  const meta = activity.metadata;
  const startedTime = formatClockTime(meta?.startedAt);
  const endedTime = formatClockTime(meta?.endedAt);
  const durationLabel = formatCallDuration(meta?.duration);
  const outcomeLabel = formatCallOutcome(meta?.outcome);
  const liveNotes = meta?.liveNotes;

  return (
    <View className="gap-3">
      {startedTime || endedTime ? (
        <View className="flex-row items-start justify-between gap-3">
          {startedTime ? (
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                Call Started
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {startedTime}
              </Text>
            </View>
          ) : null}
          {endedTime ? (
            <View className="min-w-0 flex-1 items-end">
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                Call Ended
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {endedTime}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {liveNotes ? (
        <View className="gap-1">
          <Text className="text-xs font-medium text-muted-foreground">Call Notes</Text>
          <NoteBlock text={liveNotes} />
        </View>
      ) : null}

      {outcomeLabel ? (
        <View className="flex-row items-center justify-between gap-2">
          <Text className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
            Log Call Outcome:
          </Text>
          <Badge variant="default" className="shrink-0">
            <Text>{outcomeLabel}</Text>
          </Badge>
        </View>
      ) : null}

      {durationLabel || activity.performedByName ? (
        <View className="flex-row items-center justify-between gap-2 border-t border-border pt-3">
          {activity.performedByName ? (
            <AgentAvatar
              className="flex-1"
              name={activity.performedByName}
              role={getDisplayedPerformerRole(activity, 'Agent')}
            />
          ) : (
            <View className="flex-1" />
          )}
          {durationLabel ? (
            <View className="shrink-0 items-end">
              <Text className="text-sm font-semibold text-foreground">Duration</Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {durationLabel}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function NoteCard({ activity }: Readonly<{ activity: LeadActivity }>) {
  const note = activity.metadata?.note;
  return (
    <View className="gap-2">
      <CardTitle>{ACTIVITY_LABEL_MAP[activity.action]}</CardTitle>
      <AgentAvatar
        name={getPerformerName(activity)}
        role={getDisplayedPerformerRole(activity, 'Agent')}
      />
      {note ? <NoteBlock text={note} /> : null}
    </View>
  );
}

function QualificationCard({
  activity,
  canViewContact,
}: Readonly<{ activity: LeadActivity; canViewContact: boolean }>) {
  const summary = activity.metadata?.summary;
  const hasFieldChanges = Object.keys(activity.newValue ?? {}).length > 0;

  let body: ReactNode = null;
  if (hasFieldChanges) {
    body = <FieldChanges activity={activity} canViewContact={canViewContact} />;
  } else if (summary) {
    body = <Text className="text-xs text-muted-foreground">{summary}</Text>;
  }

  return (
    <View className="gap-2">
      <CardTitle>Qualification Updated</CardTitle>
      <AgentAvatar
        name={getPerformerName(activity)}
        role={getDisplayedPerformerRole(activity, 'Agent')}
      />
      {body}
    </View>
  );
}

function LeadChangeCard({
  activity,
  canViewContact,
}: Readonly<{ activity: LeadActivity; canViewContact: boolean }>) {
  const note = activity.metadata?.note;
  const label = ACTIVITY_LABEL_MAP[activity.action];
  const defaultRole = activity.action === 'created' ? 'System' : 'Agent';
  return (
    <View className="gap-2">
      <CardTitle>{note ? `${label} (${note})` : label}</CardTitle>
      <AgentAvatar
        name={getPerformerName(activity)}
        role={getDisplayedPerformerRole(activity, defaultRole)}
      />
      <FieldChanges activity={activity} canViewContact={canViewContact} />
    </View>
  );
}

function PropertyFinderCard({ activity }: Readonly<{ activity: LeadActivity }>) {
  const meta = activity.metadata;
  const pfCreatedAt = meta?.pfCreatedAt ? new Date(meta.pfCreatedAt) : undefined;
  const pfCreatedLabel =
    pfCreatedAt && !Number.isNaN(pfCreatedAt.getTime())
      ? pfCreatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : undefined;

  return (
    <View className="gap-1.5">
      <CardTitle>{ACTIVITY_LABEL_MAP[activity.action]}</CardTitle>
      {meta?.pfChannel ? (
        <Text className="text-xs text-muted-foreground">Channel: {meta.pfChannel}</Text>
      ) : null}
      {meta?.pfLeadId ? (
        <Text className="text-xs text-muted-foreground">PF Lead ID: {meta.pfLeadId}</Text>
      ) : null}
      {pfCreatedLabel ? (
        <Text className="text-xs text-muted-foreground">PF Created: {pfCreatedLabel}</Text>
      ) : null}
      <Text className="text-xs text-muted-foreground">by System</Text>
    </View>
  );
}

function DefaultCard({ activity }: Readonly<{ activity: LeadActivity }>) {
  return (
    <View className="gap-1">
      <CardTitle>{ACTIVITY_LABEL_MAP[activity.action] ?? 'Activity'}</CardTitle>
      <Text className="text-xs text-muted-foreground">by {getPerformerName(activity)}</Text>
    </View>
  );
}

function renderCardContent(activity: LeadActivity, canViewContact: boolean): ReactNode {
  switch (activity.action) {
    case 'status_changed':
      return <StatusChangedCard activity={activity} />;
    case 'priority_changed':
      return <PriorityChangedCard activity={activity} />;
    case 'assigned':
    case 'agent_reassigned':
    case 'agent_unassigned':
      return <AssignmentCard activity={activity} />;
    case 'sms_sent':
    case 'whatsapp_sent':
    case 'whatsapp_received':
    case 'email_sent':
      return <MessageCard activity={activity} />;
    case 'call_logged':
      return <CallLoggedCard activity={activity} />;
    case 'qualification_updated':
      return <QualificationCard activity={activity} canViewContact={canViewContact} />;
    case 'notes_added':
    case 'identity_note_added':
      return <NoteCard activity={activity} />;
    case 'created':
    case 'updated':
      return <LeadChangeCard activity={activity} canViewContact={canViewContact} />;
    case 'property_finder_imported':
    case 'property_finder_merged':
      return <PropertyFinderCard activity={activity} />;
    default:
      return <DefaultCard activity={activity} />;
  }
}

function formatTime(iso: string): string {
  return formatClockTime(iso) ?? iso;
}

export interface ActivityItemProps {
  activity: LeadActivity;
  last: boolean;
  canViewContact: boolean;
}

/**
 * Single timeline row mirroring web `ActivityTimelineEntry`: a left clock-time
 * column, a coloured icon circle with a connector line down to the next item
 * (unless `last`), and a rich per-action content card on the right. Card
 * content covers call notes/outcome/duration, message channel, status/priority
 * badges, agent avatars, and lead/qualification field diffs.
 *
 * Items are grouped under `DD.MM.YYYY` date dividers by the parent
 * `ActivityLogTab` (see `group-activities-by-date`), so this row shows the
 * clock time only — not the calendar date.
 */
export function ActivityItem({ activity, last, canViewContact }: Readonly<ActivityItemProps>) {
  const style = getActivityStyle(activity.action);
  const iconName = ACTIVITY_ICON_MAP[activity.action] ?? 'Clock';

  return (
    <View className="flex-row gap-3">
      <View className="w-14 pt-1">
        <Text className="text-right text-[11px] text-muted-foreground">
          {formatTime(activity.createdAt)}
        </Text>
      </View>
      <View className="items-center pt-1">
        <View className={`h-9 w-9 items-center justify-center rounded-full ${style.bg}`}>
          <Icon name={iconName} size={16} color={style.icon} />
        </View>
        {last ? null : <View className="mt-1 w-0.5 flex-1 bg-border" />}
      </View>
      <View className="min-w-0 flex-1 pb-5">
        <View className="overflow-hidden rounded-xl border border-border bg-background p-3">
          {renderCardContent(activity, canViewContact)}
        </View>
      </View>
    </View>
  );
}
