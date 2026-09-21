import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '@/store/auth.store';

const REFETCH_DEBOUNCE_MS = 60_000;

export function usePermissionSync(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const lastFetchRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!isAuthenticated) return;

    const maybeRefresh = (reason: string): void => {
      const now = Date.now();
      if (now - lastFetchRef.current < REFETCH_DEBOUNCE_MS) return;
      lastFetchRef.current = now;
      refreshProfile().catch((e: unknown) => console.warn(`[rbac] refresh on ${reason} failed`, e));
    };

    // Cold start (after hydration sets isAuthenticated).
    maybeRefresh('cold-start');

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        maybeRefresh('foreground');
      }
    });

    return () => {
      sub.remove();
    };
  }, [isAuthenticated, refreshProfile]);
}
