/**
 * Call Service Constants — ported from web
 * `boh-lead-magnet/src/features/callService/constants/call.ts`.
 * Web-only `EVENT_OPTIONS` (passive scroll listeners) is dropped.
 */

/** Status values for active calls */
export enum CallStatus {
  IDLE = 'idle',
  CALLING = 'calling',
  RINGING = 'ringing',
  CONNECTING = 'connecting',
  IN_CALL = 'in_call',
  ON_HOLD = 'on_hold',
  NO_ANSWER = 'no_answer',
  ENDED = 'ended',
  FAILED = 'failed',
}

export const CALL_STATUS = {
  IDLE: CallStatus.IDLE,
  CALLING: CallStatus.CALLING,
  RINGING: CallStatus.RINGING,
  CONNECTING: CallStatus.CONNECTING,
  IN_CALL: CallStatus.IN_CALL,
  ON_HOLD: CallStatus.ON_HOLD,
  NO_ANSWER: CallStatus.NO_ANSWER,
  ENDED: CallStatus.ENDED,
  FAILED: CallStatus.FAILED,
} as const;

/** SIP connection status */
export enum SipStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  REGISTERING = 'registering',
  REGISTERED = 'registered',
  UNREGISTERING = 'unregistering',
  ERROR = 'error',
}

export enum CallDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export const CALL_DIRECTION = {
  INBOUND: CallDirection.INBOUND,
  OUTBOUND: CallDirection.OUTBOUND,
} as const;

/** Post-call "Log Call Outcome" options */
export enum CallOutcome {
  CONNECTED = 'connected',
  NO_ANSWER = 'no_answer',
  FOLLOW_UP_NEEDED = 'follow_up_needed',
  VOICEMAIL = 'voicemail',
  WRONG_NUMBER = 'wrong_number',
  CALL_DISCONNECTED = 'call_disconnected',
}

export const CALL_OUTCOME_OPTIONS: readonly { value: CallOutcome; label: string }[] = [
  { value: CallOutcome.CONNECTED, label: 'Connected' },
  { value: CallOutcome.NO_ANSWER, label: 'No Answer' },
  { value: CallOutcome.FOLLOW_UP_NEEDED, label: 'Follow-up Needed' },
  { value: CallOutcome.VOICEMAIL, label: 'Voicemail' },
  { value: CallOutcome.WRONG_NUMBER, label: 'Wrong Number' },
  { value: CallOutcome.CALL_DISCONNECTED, label: 'Call Disconnected' },
] as const;

/**
 * Audio output routes. Names match `react-native-incall-manager`'s
 * `chooseAudioRoute` / `onAudioDeviceChanged` device strings (Android), and are
 * mapped to AVAudioSession outputs on iOS by the native picker.
 */
export enum AudioRoute {
  EARPIECE = 'EARPIECE',
  SPEAKER_PHONE = 'SPEAKER_PHONE',
  BLUETOOTH = 'BLUETOOTH',
  WIRED_HEADSET = 'WIRED_HEADSET',
}

export const AUDIO_ROUTE_LABELS: Record<AudioRoute, string> = {
  [AudioRoute.EARPIECE]: 'Phone',
  [AudioRoute.SPEAKER_PHONE]: 'Speaker',
  [AudioRoute.BLUETOOTH]: 'Bluetooth',
  [AudioRoute.WIRED_HEADSET]: 'Headset',
} as const;

/** Sticky-widget display mode (kept for state-machine parity with web) */
export enum DialerWidgetMode {
  DIALER = 'dialer',
  ACTIVE = 'active',
  INCOMING = 'incoming',
}

export const CALL_DIRECTION_LABELS: Record<CallDirection, string> = {
  [CallDirection.INBOUND]: 'Incoming',
  [CallDirection.OUTBOUND]: 'Outgoing',
} as const;

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  [CallStatus.IDLE]: 'Idle',
  [CallStatus.CALLING]: 'Calling...',
  [CallStatus.RINGING]: 'Ringing...',
  [CallStatus.CONNECTING]: 'Connecting...',
  [CallStatus.IN_CALL]: 'In Call',
  [CallStatus.ON_HOLD]: 'On Hold',
  [CallStatus.NO_ANSWER]: 'No Answer',
  [CallStatus.ENDED]: 'Call Ended',
  [CallStatus.FAILED]: 'Call Failed',
} as const;

/** Timeout and delay values (ms unless noted) */
export const CALL_TIMING = {
  /** SIP connection timeout (seconds) */
  CONNECTION_TIMEOUT: 10,
  /** Delay before transitioning to IN_CALL status */
  CALL_CONNECT_DELAY: 500,
  /** Delay before clearing phone number after closing dialer */
  DIALER_CLOSE_DELAY: 300,
  /** Delay before attempting reconnection */
  RECONNECT_DELAY: 500,
  /** Duration timer interval */
  DURATION_TIMER_INTERVAL: 1000,
  /** Delay for auto-connect after navigation */
  AUTO_CONNECT_DELAY: 300,
  /**
   * How long the pre-INVITE "Connecting…" placeholder (shown after a cold-start
   * call answer, before SIP registers + the INVITE lands) waits before giving
   * up. Covers the worst case of boot → auth hydrate → SIP register → INVITE.
   */
  CONNECTING_ANSWER_TIMEOUT: 30000,
  /**
   * How long a cold-launch ringing placeholder (shown from the full-screen
   * incoming-call launch, before the SIP INVITE binds a session) waits before
   * clearing itself. Slightly above the native ring timeout (60s).
   */
  INCOMING_PLACEHOLDER_TIMEOUT: 65000,
  /**
   * Once SIP is REGISTERED, how long a cold-start ringing placeholder waits for
   * the INVITE to bind before giving up. A live incoming call's INVITE arrives
   * within ~1–2s of registration; if none lands in this window the call was
   * already torn down server-side (caller hung up before the phone booted), so
   * the placeholder is cleared. Much tighter than INCOMING_PLACEHOLDER_TIMEOUT,
   * which is the pre-registration safety net.
   */
  POST_REGISTER_INVITE_TIMEOUT: 10000,
  /**
   * How long the call screen lingers showing the end reason (e.g. "Busy",
   * "No answer", "Call ended") after a call terminates, before it dismisses
   * and the outcome modal opens.
   */
  END_DISPLAY_DURATION: 2500,
  // ── liveness / recovery (call-reliability) ──────────────────────────────────
  /**
   * sip.js WebSocket CRLF keep-alive period (seconds). Keeps NAT bindings warm
   * and lets the transport notice a dead socket instead of hanging silently.
   */
  WS_KEEPALIVE_INTERVAL: 30,
  /** Bounded auto-reconnect attempts on an unexpected WS drop (was 0 = off). */
  WS_RECONNECT_ATTEMPTS: 3,
  /** Delay between WS reconnect attempts (seconds). */
  WS_RECONNECT_DELAY: 4,
  /**
   * Established call with no inbound RTP growth for this long ⇒ media is dead ⇒
   * end the call (industry-standard RTP-timeout teardown). (ms)
   */
  MEDIA_TIMEOUT: 12000,
  /** How often to sample RTP liveness while a call is established. (ms) */
  MEDIA_POLL_INTERVAL: 3000,
  /**
   * Mid-call transport drop: if the WebSocket does not recover within this
   * window while a call is active, end the call (a far-end BYE can never arrive
   * over a dead socket). (ms)
   */
  MIDCALL_RECONNECT_GRACE: 8000,
} as const;
