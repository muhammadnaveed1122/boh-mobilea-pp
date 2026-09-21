import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'theme.preference';

export type ThemePreference = 'light' | 'dark' | 'system';

export async function loadThemePreference(): Promise<ThemePreference> {
  const v = await AsyncStorage.getItem(KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

export async function saveThemePreference(value: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(KEY, value);
}
