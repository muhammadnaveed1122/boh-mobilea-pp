import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Thin wrapper around expo-local-authentication for the quick-unlock flow.
 * Quick-unlock guards re-opening an already-authenticated session — it is NOT
 * a login factor and never touches tokens directly (see auth.store / _layout).
 */

/** True only when the device has biometric hardware AND the user enrolled a face/fingerprint. */
export async function isBiometricAvailable(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled;
}

/** Prompts the OS biometric sheet. Resolves true on success, false on cancel/fail/error. */
export async function authenticateBiometric(
  promptMessage = 'Unlock RHK Properties',
): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use password',
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch {
    return false;
  }
}
