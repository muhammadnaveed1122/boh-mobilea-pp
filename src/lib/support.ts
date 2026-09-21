import { Linking } from 'react-native';
import { SUPPORT_EMAIL } from '@/config/app-links';

/**
 * Open the device mail client to the configurable support address.
 * Best-effort: silently no-ops when no mail handler is available.
 */
export async function openSupport(): Promise<void> {
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  } catch {
    // Mail client unavailable — silent no-op.
  }
}
