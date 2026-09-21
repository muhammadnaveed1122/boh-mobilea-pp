/**
 * Call service Zustand store — mirrors the web Redux slice
 * `boh-lead-magnet/src/store/slices/callServiceSlice.ts` state shape EXACTLY
 * so the ported brain hook maps 1:1. Web-only widget position/minimized state
 * is dropped (mobile uses full-screen overlays, not a draggable widget).
 */

import { create } from 'zustand';

import { CallDirection, CallStatus, DIALER_VALIDATION, SipStatus } from '../constants';
import type {
  ActiveCallState,
  IncomingCall,
  OutcomeModalContext,
  SipConnectionState,
} from '../models';

interface OutcomeModalState {
  isOpen: boolean;
  context: OutcomeModalContext | null;
}

interface CallState {
  sipConnection: SipConnectionState;
  activeCall: ActiveCallState;
  incomingCall: IncomingCall | null;
  isDialerOpen: boolean;
  isCallMinimized: boolean;
  phoneNumber: string;
  showMicPermissionModal: boolean;
  outcomeModal: OutcomeModalState;
  liveNotesByLeadId: Record<string, string>;

  setSipConnection: (s: SipConnectionState) => void;
  updateSipConnection: (s: Partial<SipConnectionState>) => void;
  setActiveCall: (c: ActiveCallState) => void;
  updateActiveCall: (c: Partial<ActiveCallState>) => void;
  resetActiveCall: () => void;
  /** Show the pre-INVITE "Connecting…" placeholder for a cold-start answer. */
  beginConnectingCall: (info?: { number?: string | null; displayName?: string | null }) => void;
  setIncomingCall: (c: IncomingCall | null) => void;
  setDialerOpen: (open: boolean) => void;
  setCallMinimized: (minimized: boolean) => void;
  setPhoneNumber: (n: string) => void;
  addPhoneDigit: (digit: string) => void;
  removePhoneDigit: () => void;
  setShowMicPermissionModal: (show: boolean) => void;
  openOutcomeModal: (context: OutcomeModalContext) => void;
  closeOutcomeModal: () => void;
  setLiveNotes: (payload: { leadId: string; notes: string }) => void;
  clearLiveNotes: (leadId: string) => void;
  resetCallService: () => void;
}

const INITIAL_ACTIVE_CALL: ActiveCallState = {
  contactId: null,
  number: null,
  status: CallStatus.IDLE,
  direction: null,
  startTime: null,
  duration: 0,
  isMuted: false,
  isOnHold: false,
  isRecording: false,
};

const INITIAL = {
  sipConnection: {
    status: SipStatus.DISCONNECTED,
    isConnected: false,
    isRegistered: false,
  } as SipConnectionState,
  activeCall: INITIAL_ACTIVE_CALL,
  incomingCall: null as IncomingCall | null,
  isDialerOpen: false,
  isCallMinimized: false,
  phoneNumber: '',
  showMicPermissionModal: false,
  outcomeModal: { isOpen: false, context: null } as OutcomeModalState,
  liveNotesByLeadId: {} as Record<string, string>,
};

export const useCallStore = create<CallState>((set) => ({
  ...INITIAL,

  setSipConnection: (sipConnection) => set({ sipConnection }),
  updateSipConnection: (partial) =>
    set((state) => ({ sipConnection: { ...state.sipConnection, ...partial } })),

  setActiveCall: (activeCall) => set({ activeCall }),
  updateActiveCall: (partial) =>
    set((state) => ({ activeCall: { ...state.activeCall, ...partial } })),
  resetActiveCall: () => set({ activeCall: INITIAL_ACTIVE_CALL, isCallMinimized: false }),
  beginConnectingCall: (info) =>
    set((state) => {
      // Never clobber a live call (e.g. the INVITE already landed).
      if (isActiveCall(state.activeCall)) return {};
      return {
        activeCall: {
          ...INITIAL_ACTIVE_CALL,
          status: CallStatus.CONNECTING,
          direction: CallDirection.INBOUND,
          number: info?.number ?? null,
          displayName: info?.displayName ?? undefined,
        },
        isCallMinimized: false,
      };
    }),

  setIncomingCall: (incomingCall) => set({ incomingCall }),

  setDialerOpen: (isDialerOpen) => set({ isDialerOpen }),
  setCallMinimized: (isCallMinimized) => set({ isCallMinimized }),
  setPhoneNumber: (phoneNumber) => set({ phoneNumber }),
  addPhoneDigit: (digit) =>
    set((state) => {
      if (state.phoneNumber.length >= DIALER_VALIDATION.MAX_LENGTH) {
        return {};
      }
      return { phoneNumber: state.phoneNumber + digit };
    }),
  removePhoneDigit: () => set((state) => ({ phoneNumber: state.phoneNumber.slice(0, -1) })),

  setShowMicPermissionModal: (showMicPermissionModal) => set({ showMicPermissionModal }),

  openOutcomeModal: (context) => set({ outcomeModal: { isOpen: true, context } }),
  closeOutcomeModal: () => set({ outcomeModal: { isOpen: false, context: null } }),

  setLiveNotes: ({ leadId, notes }) =>
    set((state) => ({ liveNotesByLeadId: { ...state.liveNotesByLeadId, [leadId]: notes } })),
  clearLiveNotes: (leadId) =>
    set((state) => {
      if (!(leadId in state.liveNotesByLeadId)) return {};
      const next = { ...state.liveNotesByLeadId };
      delete next[leadId];
      return { liveNotesByLeadId: next };
    }),

  resetCallService: () => set({ ...INITIAL }),
}));

/** True when there is an active ongoing call (not idle/ended/failed). */
export function isActiveCall(activeCall: ActiveCallState | null | undefined): boolean {
  if (!activeCall) return false;
  return (
    activeCall.status !== CallStatus.IDLE &&
    activeCall.status !== CallStatus.ENDED &&
    activeCall.status !== CallStatus.FAILED
  );
}

export function selectLiveNotes(leadId: string | null | undefined) {
  return (state: CallState): string => (leadId ? (state.liveNotesByLeadId[leadId] ?? '') : '');
}
