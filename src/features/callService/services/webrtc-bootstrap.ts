/**
 * Side-effect module: registers the react-native-webrtc globals
 * (`RTCPeerConnection`, `MediaStream`, `navigator.mediaDevices`, …) the moment
 * it is imported. Import this FIRST in `app/_layout.tsx` so the globals exist
 * before any sip.js `UserAgent` is constructed, regardless of import graph.
 *
 * Does NOT import sip.js — keeps registration ordering unambiguous.
 */

import { registerGlobals } from 'react-native-webrtc';
// react-native-webrtc's index unconditionally runs `Logger.enable('rn-webrtc:*')`,
// which spams the Metro console with `rn-webrtc:pc:DEBUG …` on every peer
// connection call. Re-enable only the ERROR namespace (same Logger singleton,
// so this overrides the library's own call) unless call debugging is on.
import Logger from 'react-native-webrtc/src/Logger';

import { DEBUG_LOGS_ENABLED } from '@/lib/debug-log';

registerGlobals();

if (!DEBUG_LOGS_ENABLED) {
  Logger.enable('rn-webrtc:*:ERROR');
}
