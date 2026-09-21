import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { startNetworkLogging } from 'react-native-network-logger';
import { CONFIG } from './config';
import { ApiError } from './api-error';
import { ERROR_CODES, type ApiEnvelope, type ErrorEnvelope } from './api-types';

// HTTP inspector. Patches the global XHR (axios uses it under the hood) so every
// request/response is captured for the in-app <NetworkLogger /> screen at
// /(app)/network-logs. Must run before any request is issued, hence module load.
// Enabled in dev, or in release when EXPO_PUBLIC_ENABLE_NETWORK_LOGGER=true.
if (CONFIG.ENABLE_NETWORK_LOGGER) {
  // forceEnable: RN (and some libs) may already hold the global XHR interceptor;
  // without this the logger silently bails and the screen shows the "Unmounted"
  // notice instead of logs (see lib Logger.ts — interceptor-already-running guard).
  startNetworkLogging({ maxRequests: 500, forceEnable: true });
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  // Auth token in effect when this request was sent. Used to detect a
  // stale 401: a response for a request issued under a previous auth
  // state (e.g. logged out / pre-login in-flight) that must NOT tear
  // down a newer session created in the meantime.
  _tokenAtSend?: string | null;
}

interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
}

const REFRESH_PATH = '/api/v1/auth/refresh';

// eslint-disable-next-line import/no-named-as-default-member
export const apiClient = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: CONFIG.API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

let _authToken: string | null = null;
let _refreshToken: string | null = null;
let _onTokensRefreshed: ((tokens: RefreshedTokens) => void) | null = null;
let _onAuthFailed: (() => void) | null = null;
let _refreshPromise: Promise<string> | null = null;
// Guards against duplicate session-expiry notifications. When several requests
// are in flight as the session expires, each one's 401 reaches tearDownSession;
// without this latch each would fire _onAuthFailed, stacking N identical
// "Session expired" toasts. Reset when a fresh token is set (new session).
let _sessionTornDown = false;

export function setAuthToken(token: string | null): void {
  _authToken = token;
  if (token) _sessionTornDown = false;
}

export function setRefreshToken(token: string | null): void {
  _refreshToken = token;
}

export function setOnTokensRefreshed(cb: ((tokens: RefreshedTokens) => void) | null): void {
  _onTokensRefreshed = cb;
}

export function setOnAuthFailed(cb: (() => void) | null): void {
  _onAuthFailed = cb;
}

// Build an ApiError and throw it for the caller. Errors are surfaced inline by
// the component that made the call — there is no global error toast.
function failWith(params: ConstructorParameters<typeof ApiError>[0]): never {
  throw new ApiError(params);
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const isRefreshCall = config.url?.includes(REFRESH_PATH);
  if (_authToken && !isRefreshCall) {
    config.headers.Authorization = `Bearer ${_authToken}`;
  }
  (config as RetriableConfig)._tokenAtSend = _authToken;
  return config;
});

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in (value as Record<string, unknown>) &&
    typeof (value as { success: unknown }).success === 'boolean'
  );
}

async function refreshAccessToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;
  if (!_refreshToken) throw new Error('No refresh token');

  _refreshPromise = (async () => {
    const { data } = await apiClient.post<RefreshedTokens>(REFRESH_PATH, {
      refreshToken: _refreshToken,
    });
    _authToken = data.accessToken;
    _refreshToken = data.refreshToken;
    _onTokensRefreshed?.(data);
    return data.accessToken;
  })();

  try {
    return await _refreshPromise;
  } finally {
    _refreshPromise = null;
  }
}

// Clear tokens for an expired session. The _onAuthFailed handler surfaces its
// own "Session expired" message.
function tearDownSession(notify: boolean): void {
  setAuthToken(null);
  setRefreshToken(null);
  if (notify && !_sessionTornDown) {
    _sessionTornDown = true;
    _onAuthFailed?.();
  }
}

apiClient.interceptors.response.use(
  (response: AxiosResponse<unknown>) => {
    const body = response.data;
    if (isEnvelope(body)) {
      if (body.success) {
        const unwrapped = body.data === undefined ? body : body.data;
        return { ...response, data: unwrapped } as AxiosResponse;
      }
      failWith({
        code: body.error.code,
        message: body.error.message,
        status: response.status,
        details: body.error.details,
        requestId: body.requestId,
      });
    }
    return response;
  },
  async (error: AxiosError<ErrorEnvelope>) => {
    const status = error.response?.status;
    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? '';
    const isRefreshCall = url.includes(REFRESH_PATH);

    // A 401 only represents a session expiry when the failing request
    // actually belonged to the *current* session. Skip global teardown
    // (clearAuth + redirect) when the request was sent with no token, or
    // under a token other than the one now active:
    //   - logged-out requests (signin/signup, public browsing) — a 401
    //     there is an application error (e.g. invalid credentials), not
    //     an expired session;
    //   - stale in-flight requests that resolve after a session change.
    // Those 401s fall through and reject as ApiError for the caller
    // (e.g. AuthForm) to surface.
    const tokenAtSend = original?._tokenAtSend ?? null;
    const belongsToCurrentSession =
      !isRefreshCall && tokenAtSend != null && tokenAtSend === _authToken;

    if (status === 401 && (isRefreshCall || belongsToCurrentSession)) {
      if (original && !original._retry && !isRefreshCall && _refreshToken) {
        original._retry = true;
        try {
          const newAccessToken = await refreshAccessToken();
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${newAccessToken}`;
          return await apiClient.request(original);
        } catch {
          tearDownSession(true);
        }
      } else {
        tearDownSession(isRefreshCall || !_refreshToken);
      }
    }

    const body = error.response?.data;
    if (body && isEnvelope(body) && body.success === false) {
      failWith({
        code: body.error.code,
        message: body.error.message,
        status,
        details: body.error.details,
        requestId: body.requestId,
      });
    }

    failWith({
      code: ERROR_CODES.NETWORK_ERROR,
      message: error.message || 'Network error',
      status,
    });
  },
);
