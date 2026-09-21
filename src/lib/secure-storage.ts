import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { AuthTokens, User } from '@/types/auth.types';

const KEY_ACCESS = 'auth.accessToken';
const KEY_REFRESH = 'auth.refreshToken';
// User blob lives in AsyncStorage, not SecureStore: roles[]/permissions[] push
// it past SecureStore's 2048-byte soft limit, and it holds no secrets (tokens
// stay in SecureStore). Same key string, different backing store.
const KEY_USER = 'auth.user';
const KEY_BIOMETRIC = 'auth.biometricEnabled';

export interface PersistedAuth {
  // null when tokens survived but the user blob did not — e.g. iOS Keychain
  // persists across reinstall while AsyncStorage is wiped. Caller refetches.
  user: User | null;
  tokens: AuthTokens;
}

export async function saveAuth(user: User, tokens: AuthTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_ACCESS, tokens.accessToken),
    SecureStore.setItemAsync(KEY_REFRESH, tokens.refreshToken),
    AsyncStorage.setItem(KEY_USER, JSON.stringify(user)),
  ]);
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_ACCESS, tokens.accessToken),
    SecureStore.setItemAsync(KEY_REFRESH, tokens.refreshToken),
  ]);
}

export async function loadAuth(): Promise<PersistedAuth | null> {
  const [accessToken, refreshToken, userStored] = await Promise.all([
    SecureStore.getItemAsync(KEY_ACCESS),
    SecureStore.getItemAsync(KEY_REFRESH),
    AsyncStorage.getItem(KEY_USER),
  ]);
  // Tokens are the source of truth for "is there a session". The user blob is
  // a cache: if it is missing or unparseable the caller refetches via getProfile.
  if (!accessToken || !refreshToken) return null;
  const tokens: AuthTokens = { accessToken, refreshToken };

  // Legacy installs stored the user in SecureStore. Read it from there once,
  // then saveAuth() rewrites it to AsyncStorage on next login.
  const userRaw = userStored ?? (await SecureStore.getItemAsync(KEY_USER));
  if (!userRaw) return { user: null, tokens };
  try {
    const parsed = JSON.parse(userRaw) as Partial<User>;
    const user: User = {
      id: parsed.id ?? '',
      email: parsed.email ?? null,
      phone: parsed.phone ?? null,
      userType: parsed.userType,
      accountStatus: parsed.accountStatus,
      mfaEnabled: parsed.mfaEnabled,
      profile: parsed.profile ?? null,
      roles: parsed.roles ?? [],
      permissions: parsed.permissions ?? [],
      hasAllAccess: parsed.hasAllAccess ?? false,
    };
    // Corrupt/partial cache → treat as missing, let the caller refetch.
    return { user: user.id ? user : null, tokens };
  } catch {
    return { user: null, tokens };
  }
}

export async function clearPersistedAuth(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS),
    SecureStore.deleteItemAsync(KEY_REFRESH),
    SecureStore.deleteItemAsync(KEY_USER), // clear any legacy SecureStore copy
    AsyncStorage.removeItem(KEY_USER),
    SecureStore.deleteItemAsync(KEY_BIOMETRIC),
  ]);
}

// Quick-unlock preference. Persisted separately from tokens so it survives the
// hydration path and is read on cold start to decide whether to lock.
export async function saveBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(KEY_BIOMETRIC, enabled ? '1' : '0');
}

export async function loadBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY_BIOMETRIC)) === '1';
}
