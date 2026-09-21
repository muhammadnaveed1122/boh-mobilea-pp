/**
 * sip.js ↔ react-native-webrtc bridge.
 *
 * Strategy (Route A — see plan): `react-native-webrtc`'s `registerGlobals()`
 * installs `RTCPeerConnection`, `MediaStream`, `RTCSessionDescription`,
 * `navigator.mediaDevices`, etc. on global scope. React Native already has a
 * global `WebSocket`. With those in place sip.js's default Web
 * SessionDescriptionHandler + transport run unmodified — so the brain
 * constructs a plain `UserAgent` (no custom factory) exactly like web.
 *
 * Remote audio is NOT attached to a DOM `<audio>` element (there is none in
 * RN); `react-native-webrtc` plays the received remote track through the
 * native audio session, which `react-native-incall-manager` routes
 * (earpiece / speaker / proximity).
 *
 * If a future react-native-webrtc release proves to be missing a browser API
 * the Web SDH needs, implement a custom `SessionDescriptionHandlerFactory`
 * here (Route B) and pass it to the `UserAgent` — the brain already isolates
 * all SIP construction so only this file changes.
 */

import { registerGlobals } from 'react-native-webrtc';
import { Web } from 'sip.js';

let registered = false;

/**
 * Idempotently register the WebRTC globals. MUST run before the first sip.js
 * `UserAgent` is constructed. Also called at the top of `app/_layout.tsx` so
 * ordering is guaranteed regardless of import graph.
 */
export function ensureWebRTCRegistered(): void {
  if (registered) return;
  registerGlobals();
  registered = true;
}

/**
 * SIP.js hold modifier (SDP-level, no DOM) used for re-INVITE hold/unhold —
 * re-exported from one place so the brain does not deep-import platform paths.
 */
export const holdModifier = Web.holdModifier;
