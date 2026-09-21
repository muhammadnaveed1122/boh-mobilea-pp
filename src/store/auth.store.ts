import { create } from 'zustand';
import { getProfile } from '@/features/auth/services';
import { setAuthToken, setRefreshToken } from '@/lib/api';
import {
  clearPersistedAuth,
  saveAuth,
  saveBiometricEnabled,
  saveTokens,
} from '@/lib/secure-storage';
import { resetSessionData } from '@/lib/session';
import {
  clearSignupSession,
  saveSignupSession,
  type OtpFlow,
  type PersistedSignupSession,
} from '@/lib/signup-storage';
import type { AuthTokens, User } from '@/types/auth.types';

export interface MfaChallenge {
  tempToken: string;
  keepMeLoggedIn: boolean;
}

export type { OtpFlow };

export interface PendingSignup {
  email: string;
  resendAvailableAt?: string;
  flow: OtpFlow;
}

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  hasSkippedAuth: boolean;
  biometricEnabled: boolean;
  mfaChallenge: MfaChallenge | null;
  mfaPromptDismissed: boolean;
  mfaPromptArmed: boolean;
  pendingSignup: PendingSignup | null;
  verifiedSignupToken: string | null;
  /** ISO expiry of verifiedSignupToken. Null whenever there is no live token. */
  verifiedSignupTokenExpiresAt: string | null;
  setAuth: (user: User, tokens: AuthTokens) => void;
  hydrateAuth: (user: User, tokens: AuthTokens) => void;
  updateTokens: (tokens: AuthTokens) => void;
  updateUser: (user: User) => void;
  refreshProfile: () => Promise<void>;
  clearAuth: () => void;
  skipAuth: () => void;
  setMfaChallenge: (challenge: MfaChallenge | null) => void;
  setUserMfaEnabled: (mfaEnabled: boolean) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  dismissMfaPrompt: () => void;
  setPendingSignup: (pending: PendingSignup | null) => void;
  setVerifiedSignupToken: (token: string, expiresAt: string) => void;
  clearPendingSignup: () => void;
  /** Cold-start restore of an unfinished signup read back from disk. */
  hydrateSignupSession: (session: PersistedSignupSession) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  hasSkippedAuth: false,
  biometricEnabled: false,
  mfaChallenge: null,
  mfaPromptDismissed: false,
  mfaPromptArmed: false,
  pendingSignup: null,
  verifiedSignupToken: null,
  verifiedSignupTokenExpiresAt: null,

  setAuth: (user, tokens) => {
    const normalized: User = {
      ...user,
      roles: user.roles ?? [],
      permissions: user.permissions ?? [],
      hasAllAccess: user.hasAllAccess ?? false,
    };
    setAuthToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    saveAuth(normalized, tokens).catch((e: unknown) =>
      console.warn('[auth.store] persist setAuth failed', e),
    );
    // The signup finished the moment we hold real tokens — retire its disk copy.
    clearSignupSession().catch((e: unknown) =>
      console.warn('[auth.store] clear signup session failed', e),
    );
    set({
      user: normalized,
      tokens,
      isAuthenticated: true,
      mfaChallenge: null,
      mfaPromptDismissed: false,
      mfaPromptArmed: true,
      pendingSignup: null,
      verifiedSignupToken: null,
      verifiedSignupTokenExpiresAt: null,
    });
  },

  // Session restore on cold start. Restores auth WITHOUT arming the MFA
  // prompt — that prompt should only surface on an actual sign-in.
  hydrateAuth: (user, tokens) => {
    const normalized: User = {
      ...user,
      roles: user.roles ?? [],
      permissions: user.permissions ?? [],
      hasAllAccess: user.hasAllAccess ?? false,
    };
    setAuthToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    set({
      user: normalized,
      tokens,
      isAuthenticated: true,
      mfaChallenge: null,
      mfaPromptArmed: false,
      pendingSignup: null,
      verifiedSignupToken: null,
      verifiedSignupTokenExpiresAt: null,
    });
  },

  updateTokens: (tokens) => {
    setAuthToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    saveTokens(tokens).catch((e: unknown) =>
      console.warn('[auth.store] persist updateTokens failed', e),
    );
    set((state) => (state.user ? { tokens } : {}));
  },

  updateUser: (user) => {
    set((state) => {
      const merged: User = {
        ...user,
        roles: user.roles ?? [],
        permissions: user.permissions ?? [],
        hasAllAccess: user.hasAllAccess ?? false,
      };
      if (state.tokens) {
        saveAuth(merged, state.tokens).catch((e: unknown) =>
          console.warn('[auth.store] persist updateUser failed', e),
        );
      }
      return { user: merged };
    });
  },

  refreshProfile: async () => {
    try {
      const fresh = await getProfile();
      const merged: User = {
        ...fresh,
        roles: fresh.roles ?? [],
        permissions: fresh.permissions ?? [],
        hasAllAccess: fresh.hasAllAccess ?? false,
      };
      const tokens = useAuthStore.getState().tokens;
      if (tokens) {
        saveAuth(merged, tokens).catch((e: unknown) =>
          console.warn('[auth.store] persist refreshProfile failed', e),
        );
      }
      set({ user: merged });
    } catch (e: unknown) {
      console.warn('[auth.store] refreshProfile failed', e);
    }
  },

  clearAuth: () => {
    setAuthToken(null);
    setRefreshToken(null);
    clearPersistedAuth().catch((e: unknown) =>
      console.warn('[auth.store] clear persisted auth failed', e),
    );
    clearSignupSession().catch((e: unknown) =>
      console.warn('[auth.store] clear signup session failed', e),
    );
    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      biometricEnabled: false,
      mfaChallenge: null,
      mfaPromptDismissed: false,
      mfaPromptArmed: false,
      pendingSignup: null,
      verifiedSignupToken: null,
      verifiedSignupTokenExpiresAt: null,
    });
    // Wipe React Query cache + user-scoped Zustand stores so the next
    // login can't see the previous user's data.
    resetSessionData();
  },

  skipAuth: () => set({ hasSkippedAuth: true }),

  setMfaChallenge: (mfaChallenge) => set({ mfaChallenge }),

  setUserMfaEnabled: (mfaEnabled) =>
    set((state) => (state.user ? { user: { ...state.user, mfaEnabled } } : {})),

  setBiometricEnabled: (enabled) => {
    saveBiometricEnabled(enabled).catch((e: unknown) =>
      console.warn('[auth.store] persist biometric pref failed', e),
    );
    set({ biometricEnabled: enabled });
  },

  dismissMfaPrompt: () => set({ mfaPromptDismissed: true, mfaPromptArmed: false }),

  // Entering the OTP step. Any token from a previous attempt is now moot: a fresh OTP
  // will mint a new one, so drop it here rather than leave a stale token on disk.
  setPendingSignup: (pendingSignup) => {
    if (pendingSignup === null) {
      clearSignupSession().catch((e: unknown) =>
        console.warn('[auth.store] clear signup session failed', e),
      );
    } else {
      saveSignupSession({ ...pendingSignup, token: null, tokenExpiresAt: null }).catch(
        (e: unknown) => console.warn('[auth.store] persist pendingSignup failed', e),
      );
    }
    set({ pendingSignup, verifiedSignupToken: null, verifiedSignupTokenExpiresAt: null });
  },

  setVerifiedSignupToken: (verifiedSignupToken, expiresAt) => {
    const { pendingSignup } = useAuthStore.getState();
    if (pendingSignup) {
      saveSignupSession({
        ...pendingSignup,
        token: verifiedSignupToken,
        tokenExpiresAt: expiresAt,
      }).catch((e: unknown) => console.warn('[auth.store] persist signup token failed', e));
    }
    set({ verifiedSignupToken, verifiedSignupTokenExpiresAt: expiresAt });
  },

  clearPendingSignup: () => {
    clearSignupSession().catch((e: unknown) =>
      console.warn('[auth.store] clear signup session failed', e),
    );
    set({ pendingSignup: null, verifiedSignupToken: null, verifiedSignupTokenExpiresAt: null });
  },

  // Restore only — loadSignupSession() already dropped the token if it had expired.
  hydrateSignupSession: (session) =>
    set({
      pendingSignup: {
        email: session.email,
        flow: session.flow,
        resendAvailableAt: session.resendAvailableAt,
      },
      verifiedSignupToken: session.token,
      verifiedSignupTokenExpiresAt: session.tokenExpiresAt,
    }),
}));
