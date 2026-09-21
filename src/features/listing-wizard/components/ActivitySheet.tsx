import type { ReactNode } from 'react';
import { ActivityIndicator, Dimensions, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { EmptyState } from '@/components/atoms/EmptyState';
import { Icon, type IconName } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { STATUS_LABEL, type ListingStatus } from '@/features/listings/types';
import { useListingHistory } from '../hooks/use-listing-history';
import type { ReviewHistoryEntry } from '../services';
import type { WizardCreated } from '../hooks/use-save-content';

/** Timeline label + icon per backend history event type (full parity w/ web). */
const EVENT_META: Record<string, { label: string; icon: IconName }> = {
  created: { label: 'Listing created', icon: 'Plus' },
  submitted_for_review: { label: 'Submitted for review', icon: 'Send' },
  submitted_for_publish: { label: 'Submitted for publish', icon: 'Send' },
  resubmitted: { label: 'Resubmitted for review', icon: 'RefreshCw' },
  changes_requested: { label: 'Changes requested', icon: 'MessageSquareWarning' },
  approved: { label: 'Content approved', icon: 'CircleCheck' },
  published: { label: 'Published', icon: 'Rocket' },
  unpublished: { label: 'Unpublished', icon: 'EyeOff' },
  auto_demoted: { label: 'Auto-unpublished', icon: 'ArrowDown' },
  auto_archived: { label: 'Auto-archived', icon: 'Archive' },
  availability_changed: { label: 'Availability changed', icon: 'CalendarClock' },
  stage_changed: { label: 'Stage changed', icon: 'ArrowRightLeft' },
  agent_assigned: { label: 'Agent assigned', icon: 'UserPlus' },
  agent_unassigned: { label: 'Agent unassigned', icon: 'UserMinus' },
};

/** Human sentence for the reason tag on auto-lifecycle events. */
const REASON_TEXT: Record<string, string> = {
  trakheesi_expired: 'Permit expired',
  content_updated: 'Content updated after publishing',
  unavailable: 'Unit became unavailable',
  available: 'Unit became available',
};

const SCROLL_MAX_HEIGHT = Dimensions.get('window').height * 0.72;

function metaFor(eventType: string): { label: string; icon: IconName } {
  return EVENT_META[eventType] ?? { label: eventType.replaceAll('_', ' '), icon: 'Circle' };
}

function titleFor(entry: ReviewHistoryEntry): string {
  if (entry.eventType === 'agent_assigned' && entry.assignment?.previousOwner) {
    return 'Agent reassigned';
  }
  return metaFor(entry.eventType).label;
}

function statusText(status: string | null): string {
  if (!status) return '';
  return STATUS_LABEL[status as ListingStatus] ?? status.replaceAll('_', ' ');
}

function formatWhen(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'd MMM yyyy, h:mm a');
}

/** Very small HTML→text: strip tags + decode the few entities the editor emits. */
function stripHtml(html: string): string {
  return html
    .replaceAll(/<[^>]{0,500}>/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function diffText(value: string | null): string {
  if (value === null || value.trim() === '') return '—';
  if (/^https?:\/\//i.test(value)) {
    return value.split('/').at(-1) || value;
  }
  return value;
}

function OwnerPill({ label }: Readonly<{ label: string }>) {
  return (
    <View className="rounded-md bg-muted px-2 py-0.5">
      <Text className="text-xs font-medium text-foreground">{label}</Text>
    </View>
  );
}

function TransitionRow({ from, to }: Readonly<{ from: string; to: string }>) {
  return (
    <View className="mt-1 flex-row items-center gap-1.5">
      <OwnerPill label={from} />
      <Icon name="ArrowRight" size={14} />
      <OwnerPill label={to} />
    </View>
  );
}

function EntryDetails({ entry }: Readonly<{ entry: ReviewHistoryEntry }>) {
  const { assignment } = entry;
  return (
    <>
      {entry.fromStatus || entry.toStatus ? (
        <TransitionRow from={statusText(entry.fromStatus)} to={statusText(entry.toStatus)} />
      ) : null}

      {entry.previousStageName || entry.stageName ? (
        <TransitionRow from={entry.previousStageName ?? '—'} to={entry.stageName ?? '—'} />
      ) : null}

      {assignment ? (
        <View className="mt-1 gap-1">
          <TransitionRow
            from={assignment.previousOwner?.name ?? 'Unassigned'}
            to={assignment.newOwner?.name ?? 'Unassigned'}
          />
          {assignment.notes ? (
            <Text className="text-sm text-foreground">{assignment.notes}</Text>
          ) : null}
        </View>
      ) : null}

      {entry.reason && REASON_TEXT[entry.reason] ? (
        <Text className="mt-1 text-sm text-muted-foreground">{REASON_TEXT[entry.reason]}</Text>
      ) : null}

      {entry.fieldChanges.length > 0 ? (
        <View className="mt-2 gap-1.5 rounded-lg bg-muted/60 p-2.5">
          {entry.fieldChanges.map((c) => (
            <View key={c.field || c.label}>
              <Text className="text-xs font-semibold text-muted-foreground">{c.label}</Text>
              <View className="flex-row flex-wrap items-center gap-1">
                <Text className="text-sm text-muted-foreground line-through">
                  {diffText(c.before)}
                </Text>
                <Icon name="ArrowRight" size={13} />
                <Text className="text-sm font-medium text-foreground">{diffText(c.after)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {entry.changeNotes ? (
        <View className="mt-2 rounded-lg bg-warning/15 p-2.5 dark:bg-warning/25">
          <Text className="text-sm text-foreground">{stripHtml(entry.changeNotes)}</Text>
        </View>
      ) : null}

      {entry.agentNotes ? (
        <View className="mt-2 rounded-lg bg-info/15 p-2.5 dark:bg-info/20">
          <Text className="text-sm text-foreground">{stripHtml(entry.agentNotes)}</Text>
        </View>
      ) : null}
    </>
  );
}

function TimelineRow({ entry, isLast }: Readonly<{ entry: ReviewHistoryEntry; isLast: boolean }>) {
  const meta = metaFor(entry.eventType);
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
          <Icon name={meta.icon} size={18} />
        </View>
        {isLast ? null : <View className="w-px flex-1 bg-border" />}
      </View>
      <View className="flex-1 pb-5">
        <Text className="text-[15px] font-semibold text-foreground">{titleFor(entry)}</Text>
        {entry.actorName ? (
          <Text className="text-sm text-muted-foreground">by {entry.actorName}</Text>
        ) : null}
        <EntryDetails entry={entry} />
        <Text className="mt-1 text-xs text-muted-foreground">{formatWhen(entry.createdAt)}</Text>
      </View>
    </View>
  );
}

/**
 * Bottom-sheet activity timeline for a listing (newest first). Full parity with
 * the web wizard's Activity panel: status transitions, stage changes, field
 * diffs, assignment changes, and change/agent notes. Lazily fetches while open.
 */
export function ActivitySheet({
  created,
  visible,
  onClose,
}: Readonly<{ created: WizardCreated | null; visible: boolean; onClose: () => void }>) {
  const insets = useSafeAreaInsets();
  const history = useListingHistory(created, visible);
  const entries = history.data ?? [];

  let body: ReactNode;
  if (history.isLoading) {
    body = (
      <View className="items-center py-10">
        <ActivityIndicator />
      </View>
    );
  } else if (history.isError) {
    body = (
      <EmptyState
        icon="TriangleAlert"
        title="Couldn't load activity"
        description="Close and reopen to retry."
      />
    );
  } else if (entries.length === 0) {
    body = (
      <EmptyState
        icon="Clock"
        title="No activity yet"
        description="Review actions on this listing will appear here."
      />
    );
  } else {
    body = (
      <ScrollView
        style={{ maxHeight: SCROLL_MAX_HEIGHT }}
        showsVerticalScrollIndicator
        contentContainerClassName="pb-2"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {entries.map((entry, index) => (
          <TimelineRow key={entry.id} entry={entry} isLast={index === entries.length - 1} />
        ))}
      </ScrollView>
    );
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        {/* Backdrop sits BEHIND the sheet so it never intercepts the list's scroll gesture. */}
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close activity"
          className="absolute bottom-0 left-0 right-0 top-0 bg-black/50"
        />
        <View className="rounded-t-3xl bg-card p-5" style={{ paddingBottom: 12 + insets.bottom }}>
          <View className="mb-4 flex-row items-center gap-2">
            <Icon name="Clock" size={20} />
            <Text className="text-lg font-extrabold text-foreground">Activity</Text>
          </View>

          {body}
        </View>
      </View>
    </Modal>
  );
}
