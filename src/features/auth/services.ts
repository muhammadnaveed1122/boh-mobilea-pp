import { apiClient } from '@/lib/api';
import type { AppleSignInResult } from '@/features/auth/apple-signin';
import type {
  MfaDisableRequest,
  MfaDisableResponse,
  MfaEnableRequest,
  MfaEnableResponse,
  MfaGenerateResponse,
  MfaRegenerateBackupCodesRequest,
  MfaRegenerateBackupCodesResponse,
  MfaStatusResponse,
  MfaVerifyRequest,
  ReactivateOtpRequest,
  ResendSignupOtpResponse,
  SetPasswordRequest,
  SetPasswordResponse,
  SigninRequest,
  SigninResponse,
  SigninSuccessResponse,
  SignupRequest,
  SignupResponse,
  User,
  VerifySignupOtpRequest,
  VerifySignupOtpResponse,
} from '@/types/auth.types';

export async function getProfile(): Promise<User> {
  const { data } = await apiClient.get<User>('/api/v1/auth/profile');
  return data;
}

export async function signinUser(payload: SigninRequest): Promise<SigninResponse> {
  const { data } = await apiClient.post<SigninResponse>('/api/v1/auth/signin', payload);
  return data;
}

export async function signinWithGoogleIdToken(idToken: string): Promise<SigninSuccessResponse> {
  const { data } = await apiClient.post<SigninSuccessResponse>('/api/v1/auth/google/mobile', {
    idToken,
  });
  return data;
}

export async function signinWithAppleIdToken(
  payload: AppleSignInResult,
): Promise<SigninSuccessResponse> {
  // Send only sign-in fields — the backend DTO forbids unknown props, so the
  // delete-only authorizationCode must not be included here.
  const { identityToken, firstName, lastName, email } = payload;
  const { data } = await apiClient.post<SigninSuccessResponse>('/api/v1/auth/apple/mobile', {
    identityToken,
    firstName,
    lastName,
    email,
  });
  return data;
}

export async function verifyReactivationOtp(
  payload: ReactivateOtpRequest,
): Promise<SigninSuccessResponse> {
  const { data } = await apiClient.post<SigninSuccessResponse>(
    '/api/v1/auth/reactivate/verify-otp',
    payload,
  );
  return data;
}

export async function resendReactivationOtp(email: string): Promise<ResendSignupOtpResponse> {
  const { data } = await apiClient.post<ResendSignupOtpResponse>(
    '/api/v1/auth/reactivate/resend-otp',
    { email },
  );
  return data;
}

export async function verifyMfaSignin(payload: MfaVerifyRequest): Promise<SigninSuccessResponse> {
  const { data } = await apiClient.post<SigninSuccessResponse>(
    '/api/v1/auth/signin/mfa-verify',
    payload,
  );
  return data;
}

export async function generateMfa(): Promise<MfaGenerateResponse> {
  const { data } = await apiClient.post<MfaGenerateResponse>('/api/v1/auth/mfa/generate');
  return data;
}

export async function enableMfa(payload: MfaEnableRequest): Promise<MfaEnableResponse> {
  const { data } = await apiClient.post<MfaEnableResponse>('/api/v1/auth/mfa/enable', payload);
  return data;
}

export async function getMfaStatus(): Promise<MfaStatusResponse> {
  const { data } = await apiClient.get<MfaStatusResponse>('/api/v1/auth/mfa/status');
  return data;
}

export async function disableMfa(payload: MfaDisableRequest): Promise<MfaDisableResponse> {
  const { data } = await apiClient.post<MfaDisableResponse>('/api/v1/auth/mfa/disable', payload);
  return data;
}

export async function regenerateMfaBackupCodes(
  payload: MfaRegenerateBackupCodesRequest,
): Promise<MfaRegenerateBackupCodesResponse> {
  const { data } = await apiClient.post<MfaRegenerateBackupCodesResponse>(
    '/api/v1/auth/mfa/regenerate-backup-codes',
    payload,
  );
  return data;
}

export async function logoutUser(refreshToken?: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>('/api/v1/auth/logout', {
    refreshToken,
  });
  return data;
}

export async function signupUser(payload: SignupRequest): Promise<SignupResponse> {
  const { data } = await apiClient.post<SignupResponse>('/api/v1/auth/signup', {
    ...payload,
    channel: 'mobile',
  });
  return data;
}

export async function verifySignupOtp(
  payload: VerifySignupOtpRequest,
): Promise<VerifySignupOtpResponse> {
  const { data } = await apiClient.post<VerifySignupOtpResponse>(
    '/api/v1/auth/verify-signup-otp',
    payload,
  );
  return data;
}

export async function resendSignupOtp(email: string): Promise<ResendSignupOtpResponse> {
  const { data } = await apiClient.post<ResendSignupOtpResponse>('/api/v1/auth/resend-magic-link', {
    email,
    channel: 'mobile',
  });
  return data;
}

export async function setPassword(payload: SetPasswordRequest): Promise<SetPasswordResponse> {
  const { data } = await apiClient.post<SetPasswordResponse>('/api/v1/auth/set-password', payload);
  return data;
}

export async function forgotPasswordMobile(email: string): Promise<ResendSignupOtpResponse> {
  const { data } = await apiClient.post<ResendSignupOtpResponse>('/api/v1/auth/forgot-password', {
    email,
    channel: 'mobile',
  });
  return data;
}

export async function verifyPasswordResetOtp(
  payload: VerifySignupOtpRequest,
): Promise<VerifySignupOtpResponse> {
  const { data } = await apiClient.post<VerifySignupOtpResponse>(
    '/api/v1/auth/verify-password-reset-otp',
    payload,
  );
  return data;
}
