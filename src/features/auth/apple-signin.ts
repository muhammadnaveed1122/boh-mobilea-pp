import * as AppleAuthentication from 'expo-apple-authentication';

export interface AppleSignInResult {
  identityToken: string;
  // Apple only returns name/email on the FIRST authorization for an app. The
  // backend persists them then; later sign-ins resolve the user by the token's
  // stable `sub`, so these are undefined on subsequent attempts.
  firstName?: string;
  lastName?: string;
  email?: string;
  // Single-use code, exchanged server-side for a refresh token to revoke the
  // grant on account deletion. Only forwarded by the delete re-auth flow.
  authorizationCode?: string;
}

export class AppleSignInCancelledError extends Error {
  constructor() {
    super('Apple sign-in cancelled');
    this.name = 'AppleSignInCancelledError';
  }
}

/** True only on iOS 13+ with Sign in with Apple available on the device. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error('Apple sign-in did not return an identity token');
    }
    return {
      identityToken: credential.identityToken,
      firstName: credential.fullName?.givenName ?? undefined,
      lastName: credential.fullName?.familyName ?? undefined,
      email: credential.email ?? undefined,
      authorizationCode: credential.authorizationCode ?? undefined,
    };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'ERR_REQUEST_CANCELED') {
      throw new AppleSignInCancelledError();
    }
    throw e;
  }
}
