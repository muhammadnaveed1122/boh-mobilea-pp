/**
 * Bottom sheet host for live in-call notes. Bound to the global Zustand store
 * `liveNotesByLeadId` so notes survive sheet collapse and are picked up by
 * `CallOutcomeModal` on hangup. Save is deferred to call-end — no autosave
 * during the call (mirrors web behaviour).
 */

import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';
import BottomSheet, { BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';

import { selectLiveNotes, useCallStore } from '../store/call.store';

const NOTE_MAX = 5000;
const SNAP_POINTS = [72, '85%'] as const;

export interface CallNotesSheetHandle {
  expand: () => void;
  collapse: () => void;
}

export interface CallNotesSheetProps {
  noteKey: string;
}

export const CallNotesSheet = forwardRef<CallNotesSheetHandle, CallNotesSheetProps>(
  function CallNotesSheet({ noteKey }, ref) {
    const sheetRef = useRef<BottomSheet>(null);
    const notes = useCallStore(selectLiveNotes(noteKey));
    const setLiveNotes = useCallStore((s) => s.setLiveNotes);

    useImperativeHandle(
      ref,
      () => ({
        expand: () => sheetRef.current?.snapToIndex(1),
        collapse: () => sheetRef.current?.snapToIndex(0),
      }),
      [],
    );

    const handleChange = useCallback(
      (value: string) => {
        const next = value.length > NOTE_MAX ? value.slice(0, NOTE_MAX) : value;
        setLiveNotes({ leadId: noteKey, notes: next });
      },
      [noteKey, setLiveNotes],
    );

    const remaining = useMemo(() => NOTE_MAX - notes.length, [notes.length]);

    return (
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={SNAP_POINTS as unknown as (string | number)[]}
        enablePanDownToClose={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        backgroundStyle={{ backgroundColor: '#101827' }}
        handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.35)' }}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 4 }}>
          <View className="flex-row items-center justify-between pb-3">
            <View className="flex-row items-center gap-2">
              <Icon name="NotebookPen" size={18} color="#FFFFFF" />
              <Text className="text-base font-semibold text-white">Live notes</Text>
            </View>
            <Text className="text-xs text-white/45">{remaining} left</Text>
          </View>

          <BottomSheetTextInput
            value={notes}
            onChangeText={handleChange}
            placeholder="Capture the conversation naturally…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            multiline
            maxLength={NOTE_MAX}
            textAlignVertical="top"
            style={{
              flex: 1,
              minHeight: 200,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              padding: 14,
              fontSize: 15,
              lineHeight: 22,
              color: '#FFFFFF',
            }}
          />

          <Text className="mt-3 pb-6 text-[11px] text-white/40">
            Saved locally · syncs when you log the call outcome.
          </Text>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
