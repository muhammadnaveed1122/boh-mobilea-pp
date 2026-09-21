import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { vars, useColorScheme } from 'nativewind';
import { tokens, type ColorToken } from './tokens';
import {
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '@/lib/theme-storage';

const themeVars = {
  light: vars(tokens.light),
  dark: vars(tokens.dark),
};

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
  colorScheme: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function Theme({ children }: Readonly<{ children: React.ReactNode }>) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadThemePreference().then((value) => {
      if (cancelled) return;
      setPreference(value);
      setColorScheme(value);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [setColorScheme]);

  const applyPreference = useCallback(
    (value: ThemePreference) => {
      setPreference(value);
      setColorScheme(value);
      saveThemePreference(value).catch(() => {});
    },
    [setColorScheme],
  );

  const resolved = colorScheme ?? 'light';

  const ctxValue = useMemo<ThemeContextValue>(
    () => ({ preference, setPreference: applyPreference, colorScheme: resolved }),
    [preference, applyPreference, resolved],
  );

  if (!hydrated) {
    return <View style={[themeVars[resolved], { flex: 1 }]} />;
  }

  return (
    <ThemeContext.Provider value={ctxValue}>
      <View style={[themeVars[resolved], { flex: 1 }]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <Theme>');
  return ctx;
}

export function useThemeColor(token: ColorToken): string {
  const { colorScheme } = useColorScheme();
  const triplet = tokens[colorScheme ?? 'light'][token];
  return `rgb(${triplet})`;
}

/**
 * Theme-aware color with an explicit alpha, returned as a strict
 * `rgba(R, G, B, A)` string so RN's color parser accepts it. Use for tints
 * that must adapt to dark mode — flat hard-coded white/black hexes break
 * in the opposite theme.
 */
export function useThemeColorAlpha(token: ColorToken, alpha: number): string {
  const { colorScheme } = useColorScheme();
  const triplet = tokens[colorScheme ?? 'light'][token];
  const [r, g, b] = triplet.split(' ');
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
