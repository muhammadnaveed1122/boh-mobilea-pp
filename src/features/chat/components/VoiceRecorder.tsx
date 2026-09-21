import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { RecordingPresets, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

import { Icon } from '@/components/atoms/Icon';
import { Text } from '@/components/atoms/Text';
import { showToast } from '@/lib/toast/toast.store';
import { cn } from '@/lib/utils';
import { useTheme, useThemeColor } from '@theme';

import { HAIRLINE_DARK, HAIRLINE_LIGHT, INPUT_BG_DARK, INPUT_BG_LIGHT } from './composer-colors';
import {
  ensureRecordingPermission,
  releaseRecordingMode,
  voiceAssetFromUri,
} from '../media/record-voice';
import type { PickedAsset } from '../models/message';

const LOCK_DX = -70; // slide left past this → lock hands-free
const SLIDE_MIN_DX = -110; // how far the hint bar is allowed to travel left
const MIN_MS = 800; // discard recordings shorter than this

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  onSend: (asset: PickedAsset) => void;
  disabled?: boolean;
  /**
   * Fires whenever recording starts/stops so the composer can collapse the
   * text input and let the recording bar own the full row width.
   */
  onRecordingChange?: (recording: boolean) => void;
}

export function VoiceRecorder({ onSend, disabled = false, onRecordingChange }: Readonly<Props>) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 100);
  const destructive = useThemeColor('--destructive');
  const mutedColor = useThemeColor('--muted-foreground');
  const primaryFg = useThemeColor('--primary-foreground');
  const successColor = useThemeColor('--success');
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  const [recording, setRecording] = useState(false);
  const [locked, setLocked] = useState(false);
  const cancelledRef = useRef(false);
  const recordingRef = useRef(false);
  const slideX = useSharedValue(0);
  const lockedSV = useSharedValue(false);
  // Mirrors `recording` on the UI thread. The gesture now wraps the whole
  // recording row (bar + trailing button), so a stray touch landing on it while
  // a locked recording runs must not start/stop anything — this flag makes the
  // handlers no-op for that second gesture.
  const recordingSV = useSharedValue(false);
  const ignoreSV = useSharedValue(false);

  const start = useCallback(async () => {
    if (disabled || recordingRef.current) return;
    const ok = await ensureRecordingPermission();
    if (!ok) return;
    recordingSV.value = true;
    cancelledRef.current = false;
    setLocked(false);
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
    recordingRef.current = true;
  }, [recorder, disabled, recordingSV]);

  const finish = useCallback(
    async (cancel: boolean) => {
      if (!recordingRef.current) return;
      const liveMs = recorder.getStatus().durationMillis;
      // Use || so a falsy 0 from getStatus falls through to the polled value.
      const durationMs = liveMs || state.durationMillis || 0;
      await recorder.stop().catch(() => {});
      await releaseRecordingMode();
      const uri = recorder.uri;
      setRecording(false);
      recordingRef.current = false;
      setLocked(false);
      slideX.value = 0;
      lockedSV.value = false;
      recordingSV.value = false;
      if (cancel || uri == null || durationMs < MIN_MS) return;
      onSend(voiceAssetFromUri(uri, durationMs));
    },
    // state.durationMillis is read imperatively inside finish; excluding it from
    // deps avoids recreating finish on every 100 ms recorder-state tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recorder, onSend, slideX, lockedSV, recordingSV],
  );

  const doLock = useCallback(() => {
    setLocked(true);
  }, []);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slideX.value }] }));

  useEffect(() => {
    onRecordingChange?.(recording);
  }, [recording, onRecordingChange]);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recorder.stop().catch(() => {});
        releaseRecordingMode().catch(() => {});
      }
    };
    // cleanup only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single Pan gesture with activateAfterLongPress(180ms) — one recognizer gives
  // us both long-press activation AND translationX/Y for slide tracking.
  // Memoized so the gesture object is stable across renders (shared values and
  // useCallback'd handlers are stable refs and safe to list in deps).
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(180)
        .enabled(!disabled)
        .onStart(() => {
          // Second gesture on top of a running (locked) recording: ignore it so
          // the trash/send buttons keep working and nothing restarts.
          ignoreSV.value = recordingSV.value;
          if (ignoreSV.value) return;
          lockedSV.value = false;
          runOnJS(start)();
        })
        .onUpdate((e) => {
          if (ignoreSV.value || lockedSV.value) return;
          // Clamp slideX to [SLIDE_MIN_DX, 0] — only left-slide is meaningful.
          slideX.value = Math.max(SLIDE_MIN_DX, Math.min(0, e.translationX));
          // Slide left far enough → lock hands-free; the mic slot becomes Send.
          if (e.translationX < LOCK_DX) {
            lockedSV.value = true;
            slideX.value = 0;
            runOnJS(doLock)();
          }
        })
        .onEnd(() => {
          // Locked: the explicit trash/send buttons drive finish(); do nothing here.
          if (ignoreSV.value || lockedSV.value) return;
          // Plain hold-and-release sends the note (finish() drops it if it was
          // shorter than MIN_MS).
          runOnJS(finish)(false);
        })
        .onFinalize(() => {
          slideX.value = 0;
          if (!ignoreSV.value) lockedSV.value = false;
        }),
    [disabled, start, finish, doLock, slideX, lockedSV, recordingSV, ignoreSV],
  );

  // A plain tap never records (too short to be useful) — tell the user why
  // instead of leaving the button feeling broken. Exclusive() means this only
  // fires when the pan above did NOT activate, i.e. it really was a quick tap.
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .maxDuration(400)
        .onEnd(() => {
          if (recordingSV.value) return;
          runOnJS(showToast)('info', 'Hold the mic to record a voice note.');
        }),
    [disabled, recordingSV],
  );

  const gesture = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  // One gesture-wrapped row for every state. Keeping the GestureDetector's view
  // mounted for the whole hold is what makes slide-to-cancel / slide-to-lock
  // tracking survive the switch into the recording layout.
  return (
    <GestureDetector gesture={gesture}>
      <View className={cn('flex-row items-center', recording && 'flex-1')}>
        {recording ? (
          <View
            className="mr-2 h-11 flex-1 flex-row items-center rounded-full px-3"
            style={{
              backgroundColor: isDark ? INPUT_BG_DARK : INPUT_BG_LIGHT,
              borderWidth: 1,
              borderColor: isDark ? HAIRLINE_DARK : HAIRLINE_LIGHT,
            }}
          >
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: destructive }} />
            <Text className="ml-2 text-sm tabular-nums text-foreground">
              {fmt(state.durationMillis ?? 0)}
            </Text>
            {locked ? (
              <Pressable
                onPress={() => finish(true)}
                accessibilityRole="button"
                accessibilityLabel="Cancel recording"
                hitSlop={8}
                className="ml-auto h-8 w-8 items-center justify-center rounded-full active:bg-muted"
              >
                <Icon name="Trash2" size={18} color={destructive} />
              </Pressable>
            ) : (
              <Animated.View className="ml-auto shrink flex-row items-center" style={barStyle}>
                <Icon name="ChevronLeft" size={16} color={mutedColor} />
                <Text className="ml-1 shrink text-xs text-muted-foreground" numberOfLines={1}>
                  slide left to lock · release to send
                </Text>
              </Animated.View>
            )}
          </View>
        ) : null}

        {/* Trailing button, always in the same slot: mic (idle / holding) →
            send (locked hands-free recording). */}
        {locked ? (
          <Pressable
            onPress={() => finish(false)}
            accessibilityRole="button"
            accessibilityLabel="Send voice note"
            className="h-11 w-11 items-center justify-center rounded-full bg-primary active:opacity-80"
          >
            <Icon name="Send" size={20} color={primaryFg} />
          </Pressable>
        ) : (
          <View
            accessibilityRole="button"
            accessibilityLabel="Hold to record a voice note"
            className={cn(
              'items-center justify-center rounded-full',
              recording ? 'h-11 w-11' : 'h-8 w-8',
            )}
            style={{ backgroundColor: successColor, opacity: disabled ? 0.4 : 1 }}
          >
            <Icon name="Mic" size={recording ? 24 : 20} color={primaryFg} />
          </View>
        )}
      </View>
    </GestureDetector>
  );
}
