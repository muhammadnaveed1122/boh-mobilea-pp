/**
 * StageNoteSheet — the one stage-change surface on mobile: pick a stage, write a
 * mandatory note, submit. Mirrors web's `UpdateStatusModal` (payload field `note`).
 *
 * The 15–500 character bound is enforced here only — the API still accepts a
 * stage change with no note, and allows notes up to 1000 chars.
 *
 * Controlled via `visible` so the same sheet backs both the detail-screen status
 * badge (`StatusSelector`) and the browse-list kebab action (`MoveStageSheet`) —
 * a stage can never move without a note, whichever way the user got there.
 */

import * as React from 'react';
import { Alert, Keyboard, Platform, Pressable, View } from 'react-native';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useThemeColor } from '@theme';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Text } from '@/components/atoms/Text';
import { cn } from '@/lib/utils';
import { useUpdateLead } from '../../hooks/use-update-lead';
import { STAGE_NOTE_MAX, STAGE_NOTE_MIN, stageNoteError } from '../../constants/stage-note';
import { type BadgeTone, STATUS_BADGE_VARIANT, STATUS_FILTERS, STATUS_LABEL } from '../../types';

/** Tall enough for the stage list + note field without covering the whole screen. */
const SNAP_POINTS: string[] = ['85%'];

function statusTone(status: string): BadgeTone {
  return (STATUS_BADGE_VARIANT as Record<string, BadgeTone>)[status] ?? 'mutedSoft';
}

function statusText(status: string): string {
  return (STATUS_LABEL as Record<string, string>)[status] ?? status;
}

function selectionHaptic(): void {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

export interface StageNoteSheetProps {
  readonly leadId: string;
  /** The lead's current stage — the sheet refuses to submit until this changes. */
  readonly currentStatus: string;
  readonly visible: boolean;
  readonly onClose: () => void;
  /** Stages offered in the picker. Defaults to the full filter set. */
  readonly stages?: readonly string[];
}

export function StageNoteSheet({
  leadId,
  currentStatus,
  visible,
  onClose,
  stages = STATUS_FILTERS,
}: StageNoteSheetProps) {
  const modalRef = React.useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = React.useState<string>(currentStatus);
  const [note, setNote] = React.useState('');
  // Errors stay hidden until the user has tried to save, so an untouched sheet
  // doesn't open shouting at them.
  const [showError, setShowError] = React.useState(false);

  const sheetBg = useThemeColor('--popover');
  const handleColor = useThemeColor('--muted-foreground');
  const mutedFg = useThemeColor('--muted-foreground');
  const popoverFg = useThemeColor('--popover-foreground');
  const destructive = useThemeColor('--destructive');
  const brand = useThemeColor('--brand');

  const { mutate, isPending } = useUpdateLead(leadId);

  // `visible` is the source of truth; the sheet is imperative, so mirror it.
  //
  // The `presented` guard matters: calling `dismiss()` on a modal that was never
  // presented (which the mount-time `visible === false` pass would do) drops it
  // out of the provider's modal stack, and every later `present()` silently
  // no-ops — the badge then reads as dead.
  const presented = React.useRef(false);
  // Live snap index, fed by `onChange`. -1 means closed.
  const sheetIndex = React.useRef(-1);
  React.useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      setSelected(currentStatus);
      setNote('');
      setShowError(false);
      presented.current = true;
      modalRef.current?.present();
      // A `present()` issued while the previous close animation is still
      // running gets swallowed by the modal provider — the badge then reads as
      // dead until the next tap. Re-arm once if the sheet never actually
      // opened; by then any in-flight dismissal has settled.
      const retry = setTimeout(() => {
        if (sheetIndex.current < 0) modalRef.current?.present();
      }, 300);
      return () => clearTimeout(retry);
    }
    if (presented.current) {
      presented.current = false;
      modalRef.current?.dismiss();
    }
  }, [visible, currentStatus]);

  // The sheet can close on its own (pan down, backdrop tap, hardware back). When
  // it does, the flag must be cleared *before* `onClose` flips `visible` to
  // false, otherwise the effect above fires a second `dismiss()` on an already
  // dismissed modal — which pops it off the provider's modal stack and makes
  // every later `present()` a silent no-op.
  const handleDismiss = React.useCallback(() => {
    presented.current = false;
    onClose();
  }, [onClose]);

  const onSelect = React.useCallback((next: string) => {
    selectionHaptic();
    setSelected(next);
  }, []);

  const trimmedLength = note.trim().length;
  const noteError = stageNoteError(note);
  const stageChanged = selected !== currentStatus;
  const canSubmit = stageChanged && noteError === null && !isPending;

  const submit = React.useCallback(() => {
    if (!canSubmit) {
      setShowError(true);
      return;
    }
    mutate(
      { status: selected, note: note.trim() },
      {
        onSuccess: () => onClose(),
        onError: () =>
          Alert.alert('Update failed', 'Could not change the lead stage. Please try again.'),
      },
    );
  }, [canSubmit, mutate, note, onClose, selected]);

  const renderBackdrop = React.useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.45}
      />
    ),
    [],
  );

  const visibleError = showError
    ? (noteError ?? (stageChanged ? null : 'Pick a new stage.'))
    : null;
  const counterOverflow = trimmedLength > STAGE_NOTE_MAX;

  return (
    <BottomSheetModal
      ref={modalRef}
      enablePanDownToClose
      // Fixed snap point, not `enableDynamicSizing`: this sheet's content is a
      // `BottomSheetScrollView`, which dynamic sizing measures as zero height —
      // the sheet then "opens" invisibly and the tap reads as a dead badge.
      // Every other scrolling sheet in the app (NewChatSheet, ListingPickerSheet…)
      // uses an explicit snap point for the same reason.
      snapPoints={SNAP_POINTS}
      // Pan-down / backdrop dismissal must clear the parent's `visible` too,
      // otherwise the sheet can never be reopened for the same lead.
      onDismiss={handleDismiss}
      onChange={(index) => {
        sheetIndex.current = index;
      }}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: sheetBg }}
      handleIndicatorStyle={{ backgroundColor: handleColor, opacity: 0.4, width: 40 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="pb-1 pt-1 text-center text-base font-semibold text-popover-foreground">
          Update Stage
        </Text>
        <Text className="pb-3 text-center text-xs text-muted-foreground">
          This change will be logged in the activity history.
        </Text>

        {stages.map((status) => {
          const isSelected = selected === status;
          return (
            <Pressable
              key={status}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(status)}
              className={cn(
                'min-h-12 flex-row items-center justify-between rounded-xl px-3 py-2.5 active:bg-muted',
                isSelected && 'bg-brand/10',
              )}
            >
              <Badge variant={statusTone(status)}>
                <Text>{statusText(status)}</Text>
              </Badge>
              {isSelected ? <Check size={20} strokeWidth={3} color={brand} /> : null}
            </Pressable>
          );
        })}

        <View className="mb-1.5 mt-4 flex-row items-center justify-between">
          <Text className="text-sm font-medium text-foreground">
            Notes for Changing Lead Stage <Text className="text-destructive">*</Text>
          </Text>
          <Text
            className={cn(
              'text-xs',
              counterOverflow ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {trimmedLength}/{STAGE_NOTE_MAX}
          </Text>
        </View>

        <BottomSheetTextInput
          value={note}
          onChangeText={setNote}
          placeholder={`Why is this lead moving? (min ${STAGE_NOTE_MIN} characters)`}
          placeholderTextColor={mutedFg}
          multiline
          maxLength={STAGE_NOTE_MAX}
          style={{
            minHeight: 88,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: visibleError ? destructive : mutedFg,
            padding: 12,
            fontSize: 16,
            color: popoverFg,
            textAlignVertical: 'top',
          }}
        />

        {visibleError ? (
          <Text className="mt-1.5 text-xs text-destructive">{visibleError}</Text>
        ) : null}

        {/* Deliberately not disabled while invalid — a dead button on a phone reads
            as a broken screen. Pressing it reveals what is missing instead. */}
        <Button className="mt-4" loading={isPending} loadingLabel="Saving" onPress={submit}>
          <Text>Update Stage</Text>
        </Button>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
