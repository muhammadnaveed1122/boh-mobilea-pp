/**
 * Imperative call controller singleton — the React Native analogue of the
 * web `window.makeGlobalCall` / `window.openGlobalDialer` globals.
 *
 * `CallProvider` (which owns the SIP `UserAgent`) registers the live handlers
 * on mount. Lead components (LeadCard, HeroHeaderCard) and the dialpad call
 * `getCallController()` to start a call without being inside the provider's
 * render subtree. Returns no-ops until the provider has registered.
 */

import type { AudioRoute } from '../constants';

/**
 * All methods are fire-and-forget (`=> void`). `CallProvider` wraps the
 * brain's async handlers so callers never deal with a floating promise.
 */
export interface CallController {
  /** Start an outbound call. `leadId` is carried as the outcome-modal contactId. */
  makeCall: (number: string, displayName?: string, leadId?: string) => void;
  /** Open the manual dialer, optionally pre-filled. */
  openDialer: (number?: string) => void;
  answerCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  selectAudioRoute: (route: AudioRoute) => void;
  sendDtmf: (digit: string) => void;
}

const noop = (): void => {};

let controller: CallController = {
  makeCall: noop,
  openDialer: noop,
  answerCall: noop,
  hangup: noop,
  toggleMute: noop,
  toggleHold: noop,
  selectAudioRoute: noop,
  sendDtmf: noop,
};

export function setCallController(next: CallController): void {
  controller = next;
}

export function resetCallController(): void {
  controller = {
    makeCall: noop,
    openDialer: noop,
    answerCall: noop,
    hangup: noop,
    toggleMute: noop,
    toggleHold: noop,
    selectAudioRoute: noop,
    sendDtmf: noop,
  };
}

export function getCallController(): CallController {
  return controller;
}
