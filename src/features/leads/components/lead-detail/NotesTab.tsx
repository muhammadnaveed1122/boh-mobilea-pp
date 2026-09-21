/**
 * NotesTab — comment-thread view of every note attached to a lead.
 *
 * Notes come from two places (backend `LeadNoteSource`):
 *   - `status_change` — captured by the mandatory note field in `StageNoteSheet`
 *     whenever the lead moves between stages. Carries `statusChange {from,to}`.
 *   - `manual` — free-form notes typed elsewhere (chat details `NotesCard`).
 *
 * Rendered as a chat-style thread: avatar + author + relative time on top, an
 * optional stage-transition badge pair, then the note body in a speech bubble.
 * A filter row lets the user narrow to stage changes only, which is the common
 * "why did this lead move?" question.
 *
 * Like `ActivityLogTab`, this renders inside the lead-detail screen's outer
 * `ScrollView`, so the list is a plain `map()` — never a `FlatList`. Long
 * threads are collapsed to `COLLAPSED_COUNT` with a "Show all" toggle so the
 * page stays scrollable.
 */

import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { Badge } from '@/components/atoms/Badge';
import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import { initials } from '@/lib/format/initials';
import { cn } from '@/lib/utils';
import { useThemeColor } from '@theme';

import { useCreateLeadNote, useLeadNotes } from '../../hooks/use-lead-notes';
import type { LeadNote } from '../../types';

import { formatStatusLabel, getStatusTone } from './activity-format';

const SKELETON_KEYS: readonly string[] = ['n1', 'n2', 'n3'];

/** Notes shown before the "Show all" toggle appears. */
const COLLAPSED_COUNT = 8;

/** Backend caps `CreateLeadNoteDto.content` at 5000 chars. */
const MAX_NOTE_LENGTH = 5000;

type NotesFilter = 'all' | 'stage' | 'manual';

const FILTERS: readonly { value: NotesFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'stage', label: 'Stage changes' },
  { value: 'manual', label: 'Comments' },
];

function isStageNote(note: LeadNote): boolean {
  return note.source === 'status_change' || !!note.statusChange;
}

function matchesFilter(note: LeadNote, filter: NotesFilter): boolean {
  if (filter === 'all') return true;
  return filter === 'stage' ? isStageNote(note) : !isStageNote(note);
}

interface FilterRowProps {
  value: NotesFilter;
  onChange: (next: NotesFilter) => void;
  counts: Record<NotesFilter, number>;
}

/** Segmented chip row. Active chip is brand-filled; inactive is outlined. */
function FilterRow({ value, onChange, counts }: Readonly<FilterRowProps>) {
  return (
    <View className="flex-row gap-2">
      {FILTERS.map((filter) => {
        const active = filter.value === value;
        return (
          <Pressable
            key={filter.value}
            onPress={() => onChange(filter.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${filter.label}, ${counts[filter.value]} notes`}
            className={cn(
              'h-9 flex-row items-center gap-1.5 rounded-full border px-3',
              active ? 'border-brand bg-brand' : 'border-border bg-background',
            )}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <Text
              className={cn(
                'text-xs font-semibold',
                active ? 'text-brand-foreground' : 'text-muted-foreground',
              )}
            >
              {filter.label}
            </Text>
            <Text
              className={cn(
                'text-xs font-semibold',
                active ? 'text-brand-foreground/80' : 'text-muted-foreground/70',
              )}
            >
              {counts[filter.value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** from → to badge pair. Arrow icon carries the direction, not colour alone. */
function StageTransition({ from, to }: Readonly<{ from: string; to: string }>) {
  const arrow = useThemeColor('--muted-foreground');
  return (
    <View
      className="flex-row flex-wrap items-center gap-1.5"
      accessibilityRole="text"
      accessibilityLabel={`Stage changed from ${formatStatusLabel(from)} to ${formatStatusLabel(to)}`}
    >
      <Badge variant={getStatusTone(from)}>
        <Text>{formatStatusLabel(from)}</Text>
      </Badge>
      <Icon name="ArrowRight" size={12} color={arrow} />
      <Badge variant={getStatusTone(to)}>
        <Text>{formatStatusLabel(to)}</Text>
      </Badge>
    </View>
  );
}

function NoteRow({ note, last }: Readonly<{ note: LeadNote; last: boolean }>) {
  const stage = isStageNote(note);
  const authorName = note.author?.name ?? 'System';

  return (
    <View className={cn('flex-row gap-3', last ? '' : 'mb-4 border-b border-border pb-4')}>
      {/* Avatar column */}
      <View
        className={cn(
          'h-9 w-9 shrink-0 items-center justify-center rounded-full',
          stage ? 'bg-brand/15' : 'bg-muted',
        )}
      >
        {note.author ? (
          <Text
            className={cn(
              'text-[11px] font-semibold',
              stage ? 'text-brand' : 'text-muted-foreground',
            )}
          >
            {initials(authorName)}
          </Text>
        ) : (
          <Icon name="Bot" size={16} />
        )}
      </View>

      {/* Body column */}
      <View className="min-w-0 flex-1 gap-2">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="min-w-0 flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
            {authorName}
          </Text>
          <Text
            className="shrink-0 text-[11px] text-muted-foreground"
            accessibilityLabel={formatDateTime(note.createdAt)}
          >
            {formatRelative(note.createdAt)}
          </Text>
        </View>

        {note.statusChange ? (
          <StageTransition from={note.statusChange.from} to={note.statusChange.to} />
        ) : null}

        {/* Speech bubble — notched top-left corner points at the avatar. */}
        <View className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
          <Text className="text-sm leading-5 text-foreground">{note.content}</Text>
        </View>
      </View>
    </View>
  );
}

interface NoteComposerProps {
  leadId: string;
  /** Called after a note is created, so the parent can reveal it. */
  onCreated: () => void;
}

/**
 * Add-a-note composer. Collapsed to a single "Add a note" row until tapped
 * (progressive disclosure — the thread is the point of the tab, not the form),
 * then expands into a textarea with a live counter and Cancel / Add actions.
 */
function NoteComposer({ leadId, onCreated }: Readonly<NoteComposerProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const brandFg = useThemeColor('--brand-foreground');
  const brand = useThemeColor('--brand');
  const create = useCreateLeadNote(leadId);

  const content = draft.trim();
  const tooLong = draft.length > MAX_NOTE_LENGTH;
  const canSubmit = content !== '' && !tooLong && !create.isPending;

  const close = (): void => {
    setOpen(false);
    setDraft('');
  };

  const submitOpacity = (pressed: boolean): number => {
    if (!canSubmit) return 0.5;
    return pressed ? 0.8 : 1;
  };

  const submit = (): void => {
    if (!canSubmit) return;
    create.mutate(content, {
      onSuccess: () => {
        close();
        onCreated();
      },
      onError: () => Alert.alert('Add failed', 'Could not add the note. Please try again.'),
    });
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a note"
        className="mb-4 h-11 flex-row items-center gap-2 rounded-xl border border-dashed border-border px-3"
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
      >
        <Icon name="Plus" size={16} color={brand} />
        <Text className="text-sm font-medium text-muted-foreground">Add a note</Text>
      </Pressable>
    );
  }

  return (
    <View className="mb-4 gap-2">
      <Textarea
        value={draft}
        onChangeText={setDraft}
        placeholder="Write a note about this lead…"
        autoFocus
        editable={!create.isPending}
        hasError={tooLong}
        accessibilityLabel="Note text"
        className="min-h-24 text-sm"
      />

      <View className="flex-row items-center justify-between gap-2">
        <Text className={cn('text-xs', tooLong ? 'text-destructive' : 'text-muted-foreground')}>
          {tooLong ? `${draft.length} / ${MAX_NOTE_LENGTH} — too long` : `${draft.length} chars`}
        </Text>

        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={close}
            disabled={create.isPending}
            accessibilityRole="button"
            accessibilityLabel="Cancel note"
            className="h-10 items-center justify-center rounded-lg px-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text className="text-sm font-semibold text-muted-foreground">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Save note"
            accessibilityState={{ disabled: !canSubmit, busy: create.isPending }}
            className="h-10 min-w-20 flex-row items-center justify-center gap-1.5 rounded-lg bg-brand px-4"
            style={({ pressed }) => ({ opacity: submitOpacity(pressed) })}
          >
            {create.isPending ? (
              <ActivityIndicator size="small" color={brandFg} />
            ) : (
              <Icon name="Check" size={16} color={brandFg} />
            )}
            <Text className="text-sm font-semibold text-brand-foreground">Add</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SkeletonRow({ last }: Readonly<{ last: boolean }>) {
  return (
    <View className={cn('flex-row gap-3', last ? '' : 'mb-4 border-b border-border pb-4')}>
      <View className="h-9 w-9 rounded-full bg-muted" />
      <View className="flex-1 gap-2">
        <View className="h-4 w-1/3 rounded bg-muted" />
        <View className="h-5 w-2/3 rounded-full bg-muted" />
        <View className="h-12 w-full rounded-2xl bg-muted" />
      </View>
    </View>
  );
}

export interface NotesTabProps {
  leadId: string;
  /** Gates the composer. Mirrors `leads:update` on the notes endpoint. */
  canAddNote: boolean;
}

export function NotesTab({ leadId, canAddNote }: Readonly<NotesTabProps>) {
  const [filter, setFilter] = useState<NotesFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const destructive = useThemeColor('--destructive');
  const mutedFg = useThemeColor('--muted-foreground');

  const { data: notes = [], isLoading, isError, error, refetch } = useLeadNotes(leadId);

  const counts = useMemo<Record<NotesFilter, number>>(() => {
    const stage = notes.filter(isStageNote).length;
    return { all: notes.length, stage, manual: notes.length - stage };
  }, [notes]);

  const filtered = useMemo(
    () => notes.filter((note) => matchesFilter(note, filter)),
    [notes, filter],
  );

  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT);
  const hiddenCount = filtered.length - visible.length;

  const showEmpty = !isLoading && !isError && filtered.length === 0;
  const showList = !isLoading && !isError && filtered.length > 0;

  const emptyLabel = filter === 'manual' ? 'No comments yet' : 'No stage notes yet';

  return (
    <View className="mx-4 mt-4 rounded-2xl bg-card p-4">
      <View className="mb-3 flex-row items-center gap-2">
        <Text className="text-base font-semibold text-foreground">Notes</Text>
        {notes.length > 0 ? (
          <Badge variant="mutedSoft">
            <Text>{notes.length}</Text>
          </Badge>
        ) : null}
      </View>

      {canAddNote ? (
        <NoteComposer
          leadId={leadId}
          // A new note is always `manual`, so drop a "Stage changes" filter
          // that would otherwise hide what the user just wrote.
          onCreated={() => {
            if (filter === 'stage') setFilter('all');
          }}
        />
      ) : null}

      <View className="mb-4">
        <FilterRow value={filter} onChange={setFilter} counts={counts} />
      </View>

      {isLoading ? (
        <View>
          {SKELETON_KEYS.map((key, idx) => (
            <SkeletonRow key={key} last={idx === SKELETON_KEYS.length - 1} />
          ))}
        </View>
      ) : null}

      {isError && !isLoading ? (
        <View className="items-center py-6">
          <Icon name="CircleAlert" size={24} color={destructive} />
          <Text className="mt-2 text-center text-sm text-destructive">
            {error?.message ?? 'Failed to load notes'}
          </Text>
          <Pressable
            onPress={() => {
              refetch().catch(() => {
                // surfaced via `isError`
              });
            }}
            accessibilityRole="button"
            className="mt-3 rounded-lg bg-brand px-4 py-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-sm font-semibold text-brand-foreground">Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {showEmpty ? (
        <View className="items-center px-6 py-8">
          <Icon name="MessageSquareText" size={28} color={mutedFg} />
          <Text className="mt-2 text-sm font-medium text-muted-foreground">{emptyLabel}</Text>
          <Text className="mt-1 text-center text-xs text-muted-foreground">
            {canAddNote
              ? 'Add one above, or move the lead to a new stage — every stage change records a note.'
              : 'A note is recorded every time this lead moves to a new stage.'}
          </Text>
        </View>
      ) : null}

      {showList ? (
        <View>
          {visible.map((note, index) => (
            <NoteRow key={note.id} note={note} last={index === visible.length - 1} />
          ))}

          {hiddenCount > 0 ? (
            <Pressable
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              className="mt-4 h-11 flex-row items-center justify-center rounded-lg border border-border"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className="text-sm font-semibold text-brand">
                Show all {filtered.length} notes
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
