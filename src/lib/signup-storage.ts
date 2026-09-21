import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export type OtpFlow = 'signup' | 'reset' | 'reactivation';

/**
 * An in-progress signup/reset that outlives the process. Without this, killing the app
 * between "OTP verified" and "password set" throws away a set-password token the server
 * still considers valid, forcing a pointless re-verification.
 *
 * The token is the only secret here, so it alone goes to SecureStore; the rest is a
 * plain AsyncStorage blob. `tokenExpiresAt` mirrors the server's expiry so the client
 * can drop a dead token without a round-trip — the server re-checks regardless.
 */
export interface PersistedSignupSession {
  email: string;
  flow: OtpFlow;
  resendAvailableAt?: string;
  token: string | null;
  tokenExpiresAt: string | null;
}

const KEY_TOKEN = 'signup.verifiedToken';
const KEY_SESSION = 'signup.session';

interface StoredSessionBlob {
  email: string;
  flow: OtpFlow;
  resendAvailableAt?: string;
  tokenExpiresAt: string | null;
}

function isOtpFlow(value: unknown): value is OtpFlow {
  return value === 'signup' || value === 'reset' || value === 'reactivation';
}

function isTokenLive(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return false;
  const expiry = new Date(tokenExpiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

export async function saveSignupSession(session: PersistedSignupSession): Promise<void> {
  const blob: StoredSessionBlob = {
    email: session.email,
    flow: session.flow,
    resendAvailableAt: session.resendAvailableAt,
    tokenExpiresAt: session.tokenExpiresAt,
  };
  await Promise.all([
    AsyncStorage.setItem(KEY_SESSION, JSON.stringify(blob)),
    session.token
      ? SecureStore.setItemAsync(KEY_TOKEN, session.token)
      : SecureStore.deleteItemAsync(KEY_TOKEN),
  ]);
}

/**
 * Returns the persisted session, or null when there is none. An expired token is stripped
 * (and purged) but the session survives: the email and flow are what let the caller resend
 * an OTP instead of dumping the user back at a blank sign-up form.
 */
export async function loadSignupSession(): Promise<PersistedSignupSession | null> {
  const [raw, token] = await Promise.all([
    AsyncStorage.getItem(KEY_SESSION),
    SecureStore.getItemAsync(KEY_TOKEN),
  ]);
  if (!raw) return null;

  let parsed: Partial<StoredSessionBlob>;
  try {
    parsed = JSON.parse(raw) as Partial<StoredSessionBlob>;
  } catch {
    await clearSignupSession();
    return null;
  }

  if (!parsed.email || !isOtpFlow(parsed.flow)) {
    await clearSignupSession();
    return null;
  }

  const tokenExpiresAt = parsed.tokenExpiresAt ?? null;
  const live = isTokenLive(tokenExpiresAt);
  if (token && !live) {
    await SecureStore.deleteItemAsync(KEY_TOKEN);
  }

  return {
    email: parsed.email,
    flow: parsed.flow,
    resendAvailableAt: parsed.resendAvailableAt,
    token: live ? token : null,
    tokenExpiresAt: live ? tokenExpiresAt : null,
  };
}

export async function clearSignupSession(): Promise<void> {
  await Promise.all([AsyncStorage.removeItem(KEY_SESSION), SecureStore.deleteItemAsync(KEY_TOKEN)]);
}
