/**
 * ICE server list for the SIP.js `RTCPeerConnection`.
 *
 * STUN alone is not enough on cellular / carrier-grade-NAT networks: the
 * device offers only `host` + `srflx` candidates, FreeSWITCH tries to send
 * RTP to an unreachable private IP, and the call sits on "connecting" with
 * no audio. The coturn relay fixes this — but only if the client offers a
 * `typ relay` candidate, which requires the TURN server (with credentials)
 * in the peer-connection config.
 *
 * Everything comes from the backend: the calling-extension credentials carry
 * `ice_servers` (STUN + TURN with username/credential), used verbatim. There
 * is no env fallback — rotating the TURN secret server-side must never need
 * an app rebuild, and a stale baked-in credential is exactly what breaks
 * audio. Older backends that only send `stun_server` degrade to STUN-only.
 */

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** Drop entries with an empty/missing `urls` — an empty list breaks gathering. */
function sanitize(servers: IceServer[]): IceServer[] {
  return servers.filter((s) => (Array.isArray(s.urls) ? s.urls.length > 0 : Boolean(s.urls)));
}

/** The backend-served ICE servers for this user's calling extension. */
export function getIceServers(config?: {
  stunServer?: string;
  iceServers?: IceServer[];
}): IceServer[] {
  const fromBackend = sanitize(config?.iceServers ?? []);
  if (fromBackend.length > 0) return fromBackend;

  // Pre-`ice_servers` backend: STUN only, no relay. Calls on cellular will
  // likely have no audio until the backend serves `ice_servers`.
  return config?.stunServer ? [{ urls: [config.stunServer] }] : [];
}
