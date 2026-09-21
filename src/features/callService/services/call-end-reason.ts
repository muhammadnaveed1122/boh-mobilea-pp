/**
 * Call end-reason classification from SIP signaling.
 *
 * sip.js surfaces the reason a call ended through three channels (see the SIP
 * contract in the call-events plan):
 *   - Outgoing (Inviter) pre-answer failure → reject response status code
 *     (`inviter.invite({ requestDelegate: { onReject } })`).
 *   - Either direction, after answer → BYE with a `Reason: Q.850;cause=N` header
 *     (`session.delegate.onBye`).
 *   - Incoming (Invitation) cancelled before answer → CANCEL, optionally with a
 *     `Reason` header (`session.delegate.onCancel`).
 *
 * This module maps those raw signals onto a single `CallEndReason` the UI /
 * outcome modal can present. No backend or WebSocket involvement.
 */

import { CallDirection } from '../constants';

/** How a call ended, derived from SIP signaling. */
export enum CallEndReason {
  /** Connected call hung up normally (Q.850 cause 16). */
  COMPLETED = 'completed',
  /** Rang out — no one picked up. */
  NO_ANSWER = 'no_answer',
  /** Callee was busy. */
  BUSY = 'busy',
  /** Callee actively declined. */
  DECLINED = 'declined',
  /** Caller hung up before answer (incoming) / we cancelled our outgoing ring. */
  CANCELLED = 'cancelled',
  /** Forked ring won by another of the agent's devices. */
  ANSWERED_ELSEWHERE = 'answered_elsewhere',
  /** Number was unallocated / malformed. */
  INVALID_NUMBER = 'invalid_number',
  /** Connected call lost mid-stream (abnormal cause / transport drop). */
  DROPPED = 'dropped',
  /** Generic failure with no more specific signal. */
  FAILED = 'failed',
}

/** Parsed SIP `Reason` header (RFC 3326), e.g. `Q.850;cause=16;text="NORMAL_CLEARING"`. */
export interface ParsedReason {
  cause: number | null;
  text: string | null;
}

/** Parse a SIP `Reason` header value into its cause code + text. */
export function parseReasonHeader(header: string | undefined): ParsedReason {
  if (!header) return { cause: null, text: null };
  const causeMatch = /cause=(\d+)/i.exec(header);
  const textMatch = /text="?([^";]+)"?/i.exec(header);
  return {
    cause: causeMatch ? Number(causeMatch[1]) : null,
    text: textMatch ? textMatch[1].trim() : null,
  };
}

/** Map a Q.850 cause code (from a BYE/CANCEL `Reason` header) to an end reason. */
function mapQ850Cause(cause: number): CallEndReason | null {
  switch (cause) {
    case 16: // NORMAL_CLEARING
      return CallEndReason.COMPLETED;
    case 17: // USER_BUSY
      return CallEndReason.BUSY;
    case 18: // NO_USER_RESPONSE
    case 19: // NO_ANSWER
      return CallEndReason.NO_ANSWER;
    case 21: // CALL_REJECTED
      return CallEndReason.DECLINED;
    case 1: // UNALLOCATED_NUMBER
    case 88: // INCOMPATIBLE_DESTINATION
      return CallEndReason.INVALID_NUMBER;
    default:
      return null;
  }
}

/** Map a SIP final response status code (outgoing reject) to an end reason. */
function mapRejectStatusCode(code: number): CallEndReason {
  switch (code) {
    case 486: // Busy Here
    case 600: // Busy Everywhere
      return CallEndReason.BUSY;
    case 408: // Request Timeout
    case 480: // Temporarily Unavailable
      return CallEndReason.NO_ANSWER;
    case 487: // Request Terminated (CANCEL)
      return CallEndReason.CANCELLED;
    case 603: // Decline
      return CallEndReason.DECLINED;
    case 404: // Not Found
    case 484: // Address Incomplete
    case 485: // Ambiguous
    case 604: // Does Not Exist Anywhere
      return CallEndReason.INVALID_NUMBER;
    default:
      return CallEndReason.FAILED;
  }
}

/** Raw signals captured from the session before/at termination. */
export interface EndReasonSignals {
  /** True if the session ever reached SessionState.Established. */
  wasEstablished: boolean;
  /** SIP status code from an outgoing reject (Inviter), if any. */
  rejectCode: number | null;
  /** Parsed Reason header from a BYE/CANCEL, if any. */
  reason: ParsedReason | null;
  direction: CallDirection;
  /** True when this end was initiated locally (user tapped End / Decline). */
  localHangup: boolean;
}

/** Reason derived from a remote BYE/CANCEL `Reason` header, or null if none applies. */
function classifyFromReason(
  reason: ParsedReason,
  wasEstablished: boolean,
  direction: CallDirection,
): CallEndReason | null {
  // "Answered on another device" — FreeSWITCH marks the losing fork legs.
  if (reason.text && /LOSE_RACE/i.test(reason.text)) {
    return CallEndReason.ANSWERED_ELSEWHERE;
  }
  if (reason.cause == null) return null;

  const mapped = mapQ850Cause(reason.cause);
  if (mapped) {
    // A "normal clearing" before the call ever connected is really a
    // cancel/no-answer, not a completed call.
    if (mapped === CallEndReason.COMPLETED && !wasEstablished) {
      return direction === CallDirection.INBOUND
        ? CallEndReason.CANCELLED
        : CallEndReason.NO_ANSWER;
    }
    return mapped;
  }
  // Non-normal cause on a connected call = the line dropped.
  return wasEstablished ? CallEndReason.DROPPED : null;
}

/**
 * Classify how a call ended from the signals captured during its lifetime.
 *
 * Precedence: an explicit Q.850 Reason cause wins, then the outgoing reject
 * code, then establishment state, then who initiated the hangup.
 */
export function classifyCallEnd(signals: EndReasonSignals): CallEndReason {
  const { wasEstablished, rejectCode, reason, direction, localHangup } = signals;

  const fromReason = reason && classifyFromReason(reason, wasEstablished, direction);
  if (fromReason) return fromReason;

  // Outgoing pre-answer failure carries a SIP reject code.
  if (!wasEstablished && rejectCode != null) return mapRejectStatusCode(rejectCode);

  // Connected then ended with no abnormal signal = clean completion.
  if (wasEstablished) return CallEndReason.COMPLETED;

  // Pre-answer end that WE initiated: declined an incoming ring, or cancelled
  // our own outgoing ring.
  if (localHangup) {
    return direction === CallDirection.INBOUND ? CallEndReason.DECLINED : CallEndReason.CANCELLED;
  }

  // Never connected, no reject/Reason info: caller gave up (incoming) or it
  // simply rang out (outgoing).
  return direction === CallDirection.INBOUND ? CallEndReason.CANCELLED : CallEndReason.NO_ANSWER;
}

/** Human-readable label for the post-call summary. */
export const CALL_END_REASON_LABELS: Record<CallEndReason, string> = {
  [CallEndReason.COMPLETED]: 'Call ended',
  [CallEndReason.NO_ANSWER]: 'No answer',
  [CallEndReason.BUSY]: 'Busy',
  [CallEndReason.DECLINED]: 'Declined',
  [CallEndReason.CANCELLED]: 'Missed call',
  [CallEndReason.ANSWERED_ELSEWHERE]: 'Answered on another device',
  [CallEndReason.INVALID_NUMBER]: 'Invalid number',
  [CallEndReason.DROPPED]: 'Call dropped',
  [CallEndReason.FAILED]: 'Call failed',
};
