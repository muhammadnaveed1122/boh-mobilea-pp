/**
 * [ice-probe] temporary diagnostic — remove once TURN relay is confirmed.
 *
 * Stands up a throwaway RTCPeerConnection with the exact same iceServers the
 * real calls use and logs every ICE candidate type gathered plus every
 * `icecandidateerror` (STUN error codes: 401 unauthorized / 403 forbidden /
 * 438 stale nonce / 701 timeout). Answers, from the device alone, whether the
 * TURN ALLOCATE succeeds — and if not, exactly why the server rejected it.
 */

import { RTCPeerConnection } from 'react-native-webrtc';

import { getIceServers, type IceServer } from './ice-servers';

import { dlog } from '@/lib/debug-log';

const PROBE_TIMEOUT_MS = 15_000;

interface IceCandidateEvent {
  candidate?: { candidate?: string } | null;
}

interface IceCandidateErrorEvent {
  errorCode?: number;
  errorText?: string;
  url?: string;
  address?: string;
  port?: number;
}

// react-native-webrtc's event-target-shim typings don't expose
// `addEventListener` on the class type — narrow cast for the two events used.
interface PeerConnectionEvents {
  addEventListener(type: 'icecandidate', listener: (event: IceCandidateEvent) => void): void;
  addEventListener(
    type: 'icecandidateerror',
    listener: (event: IceCandidateErrorEvent) => void,
  ): void;
}

function candidateType(sdpFragment: string): string {
  const match = /\styp\s(\S+)/.exec(sdpFragment);
  return match?.[1] ?? '?';
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : JSON.stringify(e);
}

/** Fire-and-forget: gather candidates against the call iceServers and log the outcome. */
export function probeIceServers(config?: { stunServer?: string; iceServers?: IceServer[] }): void {
  const iceServers = getIceServers(config);
  const turnEntry = iceServers.find((s) => s.username);
  const source = (config?.iceServers?.length ?? 0) > 0 ? 'backend' : 'env';
  dlog(
    `[ice-probe] start (${source}) — turn user=${turnEntry?.username ?? 'NONE'} credLen=${turnEntry?.credential?.length ?? 0}`,
  );

  let pc: RTCPeerConnection;
  try {
    pc = new RTCPeerConnection({ iceServers });
  } catch (e: unknown) {
    dlog('[ice-probe] RTCPeerConnection ctor FAILED:', errorText(e));
    return;
  }

  const typesSeen: string[] = [];
  let finished = false;

  const finish = (reason: string) => {
    if (finished) return;
    finished = true;
    const relay = typesSeen.filter((t) => t === 'relay').length;
    dlog(
      `[ice-probe] done (${reason}) — candidates: [${typesSeen.join(', ')}] — relay=${relay} ${relay > 0 ? '✅ TURN OK' : '❌ NO RELAY'}`,
    );
    try {
      pc.close();
    } catch {
      // already closed
    }
  };

  const pcEvents = pc as unknown as PeerConnectionEvents;

  pcEvents.addEventListener('icecandidate', (event) => {
    const cand = event.candidate?.candidate;
    if (cand) {
      typesSeen.push(candidateType(cand));
      return;
    }
    finish('gathering complete'); // null candidate = end of gathering
  });

  pcEvents.addEventListener('icecandidateerror', (event) => {
    dlog(
      `[ice-probe] ICE ERROR code=${event.errorCode ?? '?'} text="${event.errorText ?? ''}" url=${event.url ?? '?'} via=${event.address ?? '?'}:${event.port ?? '?'}`,
    );
  });

  const timer = setTimeout(() => finish('timeout'), PROBE_TIMEOUT_MS);

  // A data channel gives the PC an m-line so ICE gathering actually starts.
  pc.createDataChannel('ice-probe');
  pc.createOffer({})
    .then((offer) => pc.setLocalDescription(offer))
    .catch((e: unknown) => {
      clearTimeout(timer);
      dlog('[ice-probe] offer/setLocalDescription FAILED:', errorText(e));
      finish('offer failed');
    });
}
