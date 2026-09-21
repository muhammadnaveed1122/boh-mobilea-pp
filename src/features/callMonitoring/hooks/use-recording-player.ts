import { useCallback, useEffect, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { CONFIG } from '@/lib/config';
import { useAuthStore } from '@/store/auth.store';

/** Playback speeds cycled by the speed control, in tap order. */
export const PLAYBACK_RATES = [1, 1.25, 1.5, 2, 0.75] as const;

export interface RecordingPlayer {
  /** Load + play a call's recording, or play/pause it if already loaded. */
  toggle: (uuid: string) => void;
  /** Pause and unload the current recording (collapses the transport). */
  stop: () => void;
  /** Jump to an absolute position (seconds). */
  seekTo: (seconds: number) => void;
  /** Nudge the current position by a signed delta (seconds). */
  seekBy: (delta: number) => void;
  /** Advance to the next playback rate in {@link PLAYBACK_RATES}. */
  cycleRate: () => void;
  rate: number;
  /** Recording currently loaded into the player (playing OR paused). */
  activeId: string | null;
  isPlaying: boolean;
  loadingId: string | null;
  /** Current playhead position, seconds. */
  position: number;
  /** Total clip length, seconds. */
  duration: number;
  buffering: boolean;
  error: string | null;
}

/**
 * Recordings are fetched by call uuid — the list payload's `recordingPath` is
 * unreliable (often null even when a recording exists), so we never gate on it.
 * We fetch the authed audio first to surface a clean 404 message, cache it to a
 * file, then hand the local uri to expo-audio. Mirrors the web call-monitoring
 * player.
 *
 * A single shared player instance backs the whole screen — only one recording
 * plays at a time. `activeId` marks the loaded clip so callers can mount a full
 * transport (scrub bar, speed) against it while it's paused, not just playing.
 */
export function useRecordingPlayer(): RecordingPlayer {
  const token = useAuthStore((s) => s.tokens?.accessToken ?? null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState(1);

  // Snap back to the start (paused) when the clip finishes so it can replay.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0).catch(() => {});
    }
  }, [status.didJustFinish, player]);

  const toggle = useCallback(
    (uuid: string) => {
      setError(null);

      // Same clip already loaded → play/pause without re-fetching.
      if (activeId === uuid) {
        if (status.playing) {
          player.pause();
        } else {
          const atEnd = status.duration > 0 && status.currentTime >= status.duration - 0.25;
          if (atEnd) player.seekTo(0).catch(() => {});
          player.play();
        }
        return;
      }

      // New clip → stop whatever's loaded, fetch, then load + play.
      player.pause();
      setActiveId(null);
      setLoadingId(uuid);
      (async () => {
        try {
          const res = await fetch(
            `${CONFIG.API_BASE_URL}/api/v1/call-service/calls/${encodeURIComponent(
              uuid,
            )}/recording`,
            { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
          );
          if (!res.ok) {
            throw new Error(
              res.status === 404
                ? 'Recording not available for this call.'
                : `Could not load recording (${String(res.status)}).`,
            );
          }
          const bytes = new Uint8Array(await res.arrayBuffer());
          const file = new File(Paths.cache, `recording-${uuid}.wav`);
          if (file.exists) file.delete();
          file.create();
          file.write(bytes);
          player.replace({ uri: file.uri });
          player.setPlaybackRate(rate);
          player.play();
          setActiveId(uuid);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not load recording.');
          setActiveId(null);
        } finally {
          setLoadingId(null);
        }
      })().catch(() => {});
    },
    [activeId, player, token, rate, status.playing, status.currentTime, status.duration],
  );

  const stop = useCallback(() => {
    player.pause();
    player.seekTo(0).catch(() => {});
    setActiveId(null);
    setError(null);
  }, [player]);

  const seekTo = useCallback(
    (seconds: number) => {
      const max = status.duration > 0 ? status.duration : seconds;
      player.seekTo(Math.min(Math.max(0, seconds), max)).catch(() => {});
    },
    [player, status.duration],
  );

  const seekBy = useCallback(
    (delta: number) => {
      seekTo(status.currentTime + delta);
    },
    [seekTo, status.currentTime],
  );

  const cycleRate = useCallback(() => {
    const rates = PLAYBACK_RATES as readonly number[];
    const next = rates[(rates.indexOf(rate) + 1) % rates.length] ?? 1;
    setRate(next);
    player.setPlaybackRate(next);
  }, [rate, player]);

  return {
    toggle,
    stop,
    seekTo,
    seekBy,
    cycleRate,
    rate,
    activeId,
    isPlaying: status.playing,
    loadingId,
    position: status.currentTime,
    duration: status.duration,
    buffering: status.isBuffering,
    error,
  };
}
