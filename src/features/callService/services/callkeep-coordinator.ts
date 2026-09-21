/**
 * CallKeep coordinator — a tiny module singleton that bridges the gap between
 * CallKeep's per-UUID telecom model and this app's no-arg, single-call brain
 * (`useCallService`). It holds the minimum shared state the brain needs to know
 * whether the in-flight incoming call originated from the native CallKeep UI
 * (the killed/locked FCM-wake path) versus a plain foreground SIP INVITE.
 *
 * Deliberately dependency-free (no RNCallKeep, no store) so it can be imported
 * from both the headless FCM background handler and the React tree without
 * import cycles. The CallKeep side-effects live in `callkeep.ts`; this file is
 * pure state.
 *
 * Single-call assumption: the brain only ever tracks one active call, so we
 * track one CallKeep UUID. A second concurrent CallKeep call would overwrite —
 * acceptable, since the SIP layer also rejects a second concurrent call.
 */

interface CoordinatorState {
  /** UUID of the current CallKeep call, or null when none is in flight. */
  uuid: string | null;
  /** True while the active/incoming call is owned by the native CallKeep UI. */
  callKeepDriven: boolean;
  /** Set when the user answered on the native UI before the SIP INVITE arrived. */
  pendingAnswer: boolean;
  /** True when the CallKeep call is INCOMING (vs an outbound CallKit pill). */
  incoming: boolean;
}

const state: CoordinatorState = {
  uuid: null,
  callKeepDriven: false,
  pendingAnswer: false,
  incoming: false,
};

/**
 * RFC-4122-ish v4 fallback. Only a CallKeep call identifier — not
 * security-sensitive, and a backend-supplied uuid is preferred when present.
 * Lives here (dependency-free module) so every call site shares one generator.
 */
export function newCallUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    // eslint-disable-next-line sonarjs/pseudo-random -- not security-sensitive: only a CallKeep call identifier
    const r = Math.trunc(Math.random() * 16);
    const v = c === 'x' ? r : (r % 4) + 8;
    return v.toString(16);
  });
}

/** Take ownership of a call by UUID and mark it native-driven (no pending answer). */
function beginCallKeepCall(uuid: string): void {
  // On cold-start answer, two async paths race to record the same call: the VoIP
  // push replay (displayCallKeepIncoming → here) and CallKeep getInitialEvents
  // (which replays the native Answer → markPendingAnswer). If the answer replay
  // wins first, a redundant begin for the SAME call must NOT wipe pendingAnswer —
  // otherwise onInvite never auto-accepts and the call re-rings. Only clear the
  // pending answer when this is a genuinely different call taking over.
  const sameCall = state.uuid !== null && state.uuid === uuid;
  state.uuid = uuid;
  state.callKeepDriven = true;
  if (!sameCall) state.pendingAnswer = false;
}

/** Record that a CallKeep-driven incoming call has started ringing natively. */
export function beginCallKeepIncoming(uuid: string): void {
  beginCallKeepCall(uuid);
  state.incoming = true;
}

/** True when the in-flight CallKeep call is an INCOMING call (not outbound). */
export function isCallKeepIncoming(): boolean {
  return state.callKeepDriven && state.incoming;
}

/**
 * Record that a CallKeep-driven OUTGOING call has started (iOS CallKit
 * `startCall` → Dynamic Island pill). Same shared state as the incoming case;
 * named separately for call-site clarity.
 */
export function beginCallKeepOutgoing(uuid: string): void {
  beginCallKeepCall(uuid);
  state.incoming = false;
}

/** True when the in-flight incoming call is owned by the native CallKeep UI. */
export function isCallKeepDriven(): boolean {
  return state.callKeepDriven;
}

/** The current CallKeep call UUID, or null. */
export function getCallKeepUuid(): string | null {
  return state.uuid;
}

/**
 * Record that the user tapped Answer on the native UI. If the SIP session has
 * not arrived yet, the brain replays this once `onInvite` fires.
 */
export function markPendingAnswer(): void {
  state.pendingAnswer = true;
}

/** Peek the pending-answer intent without clearing it (diagnostics/watchdog). */
export function hasPendingAnswer(): boolean {
  return state.pendingAnswer;
}

/** Read-and-clear the pending-answer intent. Returns true if an answer was queued. */
export function consumePendingAnswer(): boolean {
  const had = state.pendingAnswer;
  state.pendingAnswer = false;
  return had;
}

// ---- cold-start call timing (debug) ----
// Stamped when a wake/answer is first observed so the SIP milestones can report
// elapsed ms (answer → register → INVITE) — the window the backend must hold.
let callBootT0: number | null = null;

/** Mark the start of a cold-start call boot (answer tap / incoming launch). */
export function markCallBootStart(): void {
  callBootT0 = Date.now();
}

/** Elapsed ms since the cold-start call boot began, or null if not started. */
export function callBootElapsedMs(): number | null {
  return callBootT0 === null ? null : Date.now() - callBootT0;
}

/** Clear all CallKeep coordination state (call fully ended / torn down). */
export function resetCallKeepCoordinator(): void {
  state.uuid = null;
  state.callKeepDriven = false;
  state.pendingAnswer = false;
  state.incoming = false;
}
