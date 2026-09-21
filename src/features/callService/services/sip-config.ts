/**
 * SIP config resolution — pure port of web
 * `boh-lead-magnet/src/features/callService/hooks/useSipConfig.ts`.
 *
 * The backend returns the user's `callingExtension.credentials` (snake_case)
 * on signin/profile. There is no env fallback on mobile: without a calling
 * extension the calling UI is simply disabled (web's `window.location`
 * fallback branch is dropped — no `window` in React Native).
 */

import type { User, UserCallingExtension } from '@/types/auth.types';

import type { SipConfig } from '../models';

function getCallingExtension(user: User | null | undefined): UserCallingExtension | null {
  return user?.callingExtension ?? null;
}

/** Build a SIP config from the user's assigned calling-extension credentials. */
export function getSipConfigForUser(user: User | null | undefined): SipConfig | null {
  const ext = getCallingExtension(user);
  if (!ext) {
    return null;
  }

  const { credentials } = ext;
  const wsServer =
    credentials.websocket_url ??
    (credentials.sip_port ? `wss://${credentials.sip_server}:${credentials.sip_port}` : '');

  return {
    wsServer,
    sipUri: `sip:${credentials.username}@${credentials.domain}`,
    authUsername: credentials.username,
    authPassword: credentials.password,
    domain: credentials.domain,
    stunServer: credentials.stun_server,
    iceServers: credentials.ice_servers,
  };
}

/** True when the user has a calling extension with the minimum usable creds. */
export function hasCallingExtensionForUser(user: User | null | undefined): boolean {
  const ext = getCallingExtension(user);
  if (!ext) return false;
  const { credentials } = ext;
  return Boolean(
    credentials.username &&
    credentials.password &&
    (credentials.websocket_url || (credentials.sip_server && credentials.sip_port)),
  );
}

/** The agent's own extension number (used by the speed-to-lead connect/skip API). */
export function getAgentExtension(user: User | null | undefined): string {
  return user?.callingExtension?.extension ?? '';
}

/** Validate a resolved SIP config; returns a list of human-readable errors. */
export function validateSipConfig(config: SipConfig): string[] {
  const errors: string[] = [];
  if (!config.wsServer) {
    errors.push('WebSocket server URL is required');
  } else if (!config.wsServer.startsWith('ws://') && !config.wsServer.startsWith('wss://')) {
    errors.push('WebSocket server must start with ws:// or wss://');
  }
  if (!config.sipUri) {
    errors.push('SIP URI is required');
  } else if (!config.sipUri.startsWith('sip:')) {
    errors.push('SIP URI must start with sip:');
  }
  if (!config.authUsername) errors.push('Username is required');
  if (!config.authPassword) errors.push('Password is required');
  if (!config.domain) errors.push('Domain is required');
  return errors;
}
