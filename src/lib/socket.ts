// Imperative Socket.IO client. Mirrors the web SocketContext connection
// options/teardown (boh-lead-magnet/src/context/SocketContext.tsx) but is
// imperative (mobile has no SocketProvider — NotificationsProvider drives it).
//
// Backend Socket.IO server listens on a SEPARATE port (SOCKET_PORT, default
// 3002) at path /socket.io and authenticates the JWT from handshake auth.token.

import { io, type Socket } from 'socket.io-client';

import { CONFIG } from '@/lib/config';

import { dlog } from '@/lib/debug-log';

/**
 * Socket.IO server origin. Set EXPO_PUBLIC_SOCKET_URL per environment
 * (local dev uses a separate port, e.g. http://<LAN-IP>:3002; QA/prod is the
 * reverse-proxied API origin). Falls back to the API base origin.
 */
export function resolveSocketUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();
  return (configured && configured !== '' ? configured : CONFIG.API_BASE_URL).replace(/\/$/, '');
}

/**
 * Disconnect without relying on transport state — pending connections (server
 * down, app suspended) otherwise leak "WebSocket closed before connection
 * established" warnings. Ported from web teardownSocket.
 */
function teardownSocket(client: Socket): void {
  client.removeAllListeners();
  try {
    if (!client.connected) {
      client.io.engine.close();
    }
  } catch {
    /* noop */
  }
  client.disconnect();
}

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(): Socket | null {
  return socket;
}

type SocketHandler = (...args: unknown[]) => void;

/**
 * Handlers registered via `subscribeSocket`, kept OUTSIDE the `Socket` instance
 * so they survive (a) a subscriber mounting before the socket exists and (b)
 * `connectSocket` swapping in a brand-new `Socket` on token rotation.
 */
const registry = new Map<string, Set<SocketHandler>>();

/** (Re)bind every registered handler onto a freshly created socket. */
function bindRegistry(client: Socket): void {
  for (const [event, handlers] of registry) {
    for (const handler of handlers) {
      client.on(event, handler);
    }
  }
}

/**
 * Subscribe to a socket event in a connection-lifecycle-safe way. Use this
 * instead of `getSocket()?.on(...)` for any listener that can mount before the
 * socket is connected — React runs child effects before parent effects, so a
 * screen rendered in the same commit as `NotificationsProvider` (e.g. the home
 * tab) sees `getSocket() === null` and would otherwise never subscribe at all.
 *
 * The handler is attached to the current socket if one exists and re-attached
 * automatically to every socket built later (cold start, reconnect after
 * logout, token rotation). Returns an unsubscribe function.
 */
export function subscribeSocket<T = unknown>(
  event: string,
  handler: (payload: T) => void,
): () => void {
  const stored = handler as SocketHandler;
  let handlers = registry.get(event);
  if (handlers === undefined) {
    handlers = new Set<SocketHandler>();
    registry.set(event, handlers);
  }
  handlers.add(stored);
  socket?.on(event, stored);

  return () => {
    const set = registry.get(event);
    if (set !== undefined) {
      set.delete(stored);
      if (set.size === 0) {
        registry.delete(event);
      }
    }
    socket?.off(event, stored);
  };
}

/**
 * Connect (or reuse) the socket for the given access token. Re-connects with a
 * fresh handshake when the token changes (token rotation / re-login).
 */
export function connectSocket(token: string): Socket {
  if (socket && currentToken === token) {
    return socket;
  }
  if (socket) {
    teardownSocket(socket);
    socket = null;
  }
  const url = resolveSocketUrl();
  const next = io(url, {
    auth: { token },
    transports: ['websocket', 'polling'],
    path: '/socket.io',
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });
  if (__DEV__) {
    next.on('connect', () => dlog('[socket] connected', url));
    next.on('connect_error', (e: Error) => dlog('[socket] connect_error', url, e.message));
    next.on('disconnect', (r: string) => dlog('[socket] disconnect', r));
  }
  // Re-attach subscribe-registry handlers: this socket is a NEW object, and
  // `teardownSocket` stripped the old one's listeners.
  bindRegistry(next);
  socket = next;
  currentToken = token;
  return next;
}

export function disconnectSocket(): void {
  if (socket) {
    teardownSocket(socket);
    socket = null;
  }
  currentToken = null;
}
