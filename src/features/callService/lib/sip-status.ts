import { SipStatus } from '../constants';
import type { SipConnectionState } from '../models';

export type SipStatusTone = 'success' | 'warning' | 'destructive';

export interface SipStatusPresentation {
  /**
   * Whether to surface the indicator at all. False when the service is idle /
   * never started (DISCONNECTED) — no connection means nothing to show.
   */
  visible: boolean;
  /** True only when transport is up AND the agent is SIP-registered (ready for calls). */
  connected: boolean;
  tone: SipStatusTone;
  /** Short status word for a settings-row trailing value, e.g. "Connected". */
  label: string;
  /** Full sentence for the profile identity caption, e.g. "Calling service connected". */
  caption: string;
  /** Solid dot color class (`bg-success` | `bg-warning` | `bg-destructive`). */
  dotClass: string;
  /** Status text color class (`text-success` | `text-warning` | `text-destructive`). */
  textClass: string;
}

const TONE_CLASS: Record<SipStatusTone, { dot: string; text: string }> = {
  success: { dot: 'bg-success', text: 'text-success' },
  warning: { dot: 'bg-warning', text: 'text-warning' },
  destructive: { dot: 'bg-destructive', text: 'text-destructive' },
};

/**
 * Maps a raw SIP connection state to the presentation used by the profile
 * screen (green dot + "Calling service connected" caption). "Connected" means
 * fully registered — transport-only states read as "Connecting…".
 */
export function getSipStatusPresentation(sip: SipConnectionState): SipStatusPresentation {
  const connected = sip.isRegistered && sip.status === SipStatus.REGISTERED;

  let tone: SipStatusTone;
  let label: string;
  let caption: string;

  if (connected) {
    tone = 'success';
    label = 'Connected';
    caption = 'Calling service connected';
  } else if (sip.status === SipStatus.ERROR) {
    tone = 'destructive';
    label = 'Error';
    caption = 'Calling service error';
  } else if (sip.status === SipStatus.DISCONNECTED) {
    tone = 'destructive';
    label = 'Disconnected';
    caption = 'Calling service disconnected';
  } else {
    // CONNECTING | CONNECTED (transport only) | REGISTERING | UNREGISTERING
    tone = 'warning';
    label = sip.status === SipStatus.UNREGISTERING ? 'Disconnecting…' : 'Connecting…';
    caption = 'Calling service connecting…';
  }

  return {
    visible: sip.status !== SipStatus.DISCONNECTED,
    connected,
    tone,
    label,
    caption,
    dotClass: TONE_CLASS[tone].dot,
    textClass: TONE_CLASS[tone].text,
  };
}
