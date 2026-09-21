/**
 * Call Service models — ported subset of web
 * `boh-lead-magnet/src/features/callService/models/call.ts`.
 * Web DOM-only prop interfaces (CallModalProps, DialerWidgetProps, …) are
 * dropped — mobile rebuilds the UI with React Native components.
 */

import type { CallDirection, CallStatus, SipStatus } from '../constants';
import type { CallEndReason } from '../services/call-end-reason';
import type { IceServer } from '../services/ice-servers';

/** Current active call state */
export interface ActiveCallState {
  contactId: string | null;
  number: string | null;
  displayName?: string;
  avatarUrl?: string;
  carrier?: string;
  status: CallStatus;
  direction: CallDirection | null;
  startTime: string | null;
  duration: number; // seconds
  isMuted: boolean;
  isOnHold: boolean;
  isRecording: boolean;
  /**
   * Set only during the brief post-call "ending" window (status is terminal):
   * how the call ended, so the call screen can show the reason for a couple of
   * seconds before it dismisses. Cleared on reset.
   */
  endReason?: CallEndReason;
}

/** Resolved SIP configuration */
export interface SipConfig {
  wsServer: string;
  sipUri: string;
  authUsername: string;
  authPassword: string;
  domain: string;
  stunServer?: string;
  /** Backend-served ICE servers (STUN + TURN). Wins over the build-time env list. */
  iceServers?: IceServer[];
}

/** SIP connection state */
export interface SipConnectionState {
  status: SipStatus;
  isConnected: boolean;
  isRegistered: boolean;
  error?: string;
}

/** Incoming call info */
export interface IncomingCall {
  number: string;
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Context captured at the moment a call ends so the outcome modal can log it.
 * Mirrors web `OutcomeModalContext` in `callServiceSlice.ts`.
 */
export interface OutcomeModalContext {
  leadId: string | null;
  number: string | null;
  displayName?: string | null;
  direction: CallDirection | null;
  duration: number;
  startedAt: string | null;
  endedAt: string;
  /** How the call ended, classified from SIP signaling. */
  endReason?: CallEndReason;
}
