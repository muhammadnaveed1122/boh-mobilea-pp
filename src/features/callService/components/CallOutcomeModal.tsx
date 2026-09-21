/**
 * Post-call "Log Call Outcome" modal — RN port of web
 * `boh-lead-magnet/src/features/callService/components/CallOutcomeModal.tsx`.
 *
 * Reuses the existing leads `useUpdateLead` mutation → PATCH /leads/{id} with
 * a `callLog` payload (backend already accepts this in production). Preserves
 * web behaviour: zero-duration calls are auto-saved silently with no modal;
 * the outcome picker only shows for `duration > 0`; live notes are cleared on
 * success.
 */

import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/atoms/Button';
import { Dialog } from '@/components/atoms/Dialog';
import { Text } from '@/components/atoms/Text';
import { Textarea } from '@/components/atoms/Textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/atoms/ToggleGroup';
import { useUpdateLead } from '@/features/leads/hooks/use-update-lead';

import { CALL_OUTCOME_OPTIONS, type CallOutcome } from '../constants';
import { selectLiveNotes, useCallStore } from '../store/call.store';
import { formatDuration } from '../utils/format-duration';
import { GradientAvatar } from './GradientAvatar';

const NOTE_MAX = 5000;

export function CallOutcomeModal() {
  const isOpen = useCallStore((s) => s.outcomeModal.isOpen);
  const context = useCallStore((s) => s.outcomeModal.context);
  const liveNotes = useCallStore(selectLiveNotes(context?.leadId));
  const closeOutcomeModal = useCallStore((s) => s.closeOutcomeModal);
  const clearLiveNotes = useCallStore((s) => s.clearLiveNotes);
  const setLiveNotes = useCallStore((s) => s.setLiveNotes);

  const [selected, setSelected] = useState<CallOutcome | null>(null);
  const { mutateAsync, isPending } = useUpdateLead(context?.leadId ?? '');

  const saveCallLog = useCallback(
    async (outcome: CallOutcome | null) => {
      if (!context?.leadId) {
        closeOutcomeModal();
        return;
      }
      try {
        await mutateAsync({
          callLog: {
            outcome: outcome ?? undefined,
            liveNotes: liveNotes || undefined,
            number: context.number,
            displayName: context.displayName ?? null,
            direction: context.direction,
            duration: context.duration,
            startedAt: context.startedAt ?? undefined,
            endedAt: context.endedAt,
          },
        });
        clearLiveNotes(context.leadId);
      } catch {
        // outcome save failed — modal still closes
      } finally {
        closeOutcomeModal();
      }
    },
    [context, liveNotes, mutateAsync, closeOutcomeModal, clearLiveNotes],
  );

  useEffect(() => {
    if (isOpen) setSelected(null);
  }, [isOpen]);

  // Auto-save (no modal) for calls that never connected.
  useEffect(() => {
    if (!isOpen || !context || context.duration > 0) return;
    void saveCallLog(null);
  }, [isOpen, context, saveCallLog]);

  if (!isOpen || !context || context.duration === 0) {
    return null;
  }

  const title = context.displayName || context.number || 'Unknown';
  const onNotesChange = (value: string) => {
    if (!context.leadId) return;
    const next = value.length > NOTE_MAX ? value.slice(0, NOTE_MAX) : value;
    setLiveNotes({ leadId: context.leadId, notes: next });
  };

  return (
    <Dialog
      visible={isOpen}
      onRequestClose={() => void saveCallLog(null)}
      title="Log call"
      scrollable
    >
      <View className="mb-4 flex-row items-center gap-3">
        <GradientAvatar name={title} size={52} />
        <View className="flex-1">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-muted-foreground">
            Duration {formatDuration(context.duration)}
          </Text>
        </View>
      </View>

      <Text className="mb-2 text-sm font-medium text-foreground">Outcome</Text>
      <ToggleGroup
        type="single"
        value={selected ?? ''}
        onValueChange={(v) => v && setSelected(v as CallOutcome)}
        className="-mb-2 -mr-2 flex-row flex-wrap"
      >
        {CALL_OUTCOME_OPTIONS.map(({ value, label }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            className="mb-2 mr-2"
            activeClassName="bg-brand border-brand"
            inactiveClassName="bg-transparent border-border"
            activeTextClassName="text-brand-foreground"
            inactiveTextClassName="text-foreground"
          >
            <Text>{label}</Text>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <View className="mt-5">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm font-medium text-foreground">Notes</Text>
          <Text className="text-[11px] text-muted-foreground">
            {NOTE_MAX - liveNotes.length} left
          </Text>
        </View>
        <Textarea
          value={liveNotes}
          onChangeText={onNotesChange}
          placeholder="Add or refine the notes you took during the call…"
          maxLength={NOTE_MAX}
          numberOfLines={5}
          style={{ minHeight: 110 }}
        />
      </View>

      <View className="mt-5 flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1"
          disabled={isPending}
          onPress={() => void saveCallLog(null)}
        >
          <Text>Skip</Text>
        </Button>
        <Button
          variant="default"
          className="flex-1"
          disabled={!selected || isPending}
          loading={isPending}
          onPress={() => void saveCallLog(selected)}
        >
          <Text>Save</Text>
        </Button>
      </View>
    </Dialog>
  );
}
