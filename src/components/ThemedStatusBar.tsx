import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@theme';

/**
 * Single source of truth for system status bar content color.
 * Driven by the in-app theme (not system scheme) so the icons stay
 * legible against `bg-background` on every screen, including when the
 * user overrides the OS color scheme. Under Android edge-to-edge the
 * bar is transparent — only `style` (icon color) matters here.
 */
export function ThemedStatusBar() {
  const { colorScheme } = useTheme();
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}
