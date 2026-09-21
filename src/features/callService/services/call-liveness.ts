/**
 * Call-liveness monitor. Industry-standard teardown backstop: a call ends the
 * moment its media path dies, independent of whether a SIP BYE is ever received
 * over the (possibly dead) WebSocket.
 *
 * Two signals:
 *  - RTCPeerConnection connectionstatechange / iceconnectionstatechange ===
 *    'failed' (fast: ICE fully broke — network handoff, far-end gone).
 *  - RTP-growth timeout: inbound audio packets stop increasing for MEDIA_TIMEOUT
 *    while the PC still claims 'connected' (far-end froze / one-way media death).
 *
 * `onDead` fires at most once; the caller drives gracefulEnd.
 */

import type { RTCPeerConnection } from 'react-native-webrtc';
import type { Session } from 'sip.js';

import { CALL_TIMING } from '../constants';

import { dlog } from '@/lib/debug-log';

interface PeerHolder {
  sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection };
}

function pcOf(session: Session): RTCPeerConnection | undefined {
  return (session as unknown as PeerHolder).sessionDescriptionHandler?.peerConnection;
}

interface RtpStat {
  type?: string;
  kind?: string;
  mediaType?: string;
  packetsReceived?: number;
}

/**
 * react-native-webrtc's RTCPeerConnection extends event-target-shim's
 * EventTarget (so add/removeEventListener exist at runtime), but the package's
 * exported type doesn't surface those methods — narrow to just what we use.
 */
interface PcEventTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export function startCallLiveness(session: Session, onDead: (reason: string) => void): () => void {
  const pc = pcOf(session);
  const pcEvents = pc as unknown as PcEventTarget | undefined;
  let fired = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastPackets = -1;
  let lastGrowthAt = Date.now();

  const cleanup = (): void => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    pcEvents?.removeEventListener('connectionstatechange', onConnState);
    pcEvents?.removeEventListener('iceconnectionstatechange', onIceState);
  };

  const die = (reason: string): void => {
    if (fired) return;
    fired = true;
    cleanup();
    dlog(`[callend][liveness] media dead → ${reason}`);
    onDead(reason);
  };

  function onConnState(): void {
    if (pc?.connectionState === 'failed') die('pc.connectionState=failed');
  }
  function onIceState(): void {
    if (pc?.iceConnectionState === 'failed') die('iceConnectionState=failed');
  }

  const poll = async (): Promise<void> => {
    if (!pc || fired) return;
    try {
      const report = (await pc.getStats()) as unknown as {
        forEach: (cb: (s: RtpStat) => void) => void;
      };
      let received = 0;
      report.forEach((s) => {
        if (s.type === 'inbound-rtp' && (s.kind === 'audio' || s.mediaType === 'audio')) {
          received = s.packetsReceived ?? received;
        }
      });
      if (received > lastPackets) {
        lastPackets = received;
        lastGrowthAt = Date.now();
      } else if (Date.now() - lastGrowthAt > CALL_TIMING.MEDIA_TIMEOUT) {
        die(`no inbound RTP for ${CALL_TIMING.MEDIA_TIMEOUT}ms`);
      }
    } catch {
      // getStats can transiently fail; ignore — the connectionstate path still guards.
    }
  };

  if (pc && pcEvents) {
    pcEvents.addEventListener('connectionstatechange', onConnState);
    pcEvents.addEventListener('iceconnectionstatechange', onIceState);
    pollTimer = setInterval(() => void poll(), CALL_TIMING.MEDIA_POLL_INTERVAL);
  }
  return cleanup;
}
