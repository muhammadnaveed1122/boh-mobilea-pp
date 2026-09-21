export interface UserProfile {
  firstName: string;
  lastName: string;
  fullName: string | null;
  profilePicUrl: string | null;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isAllAccess: boolean;
  roleTag: string | null;
}

export interface Permission {
  id: string;
  code: string;
  resource: string;
  action: string;
  name: string;
  scope: string;
}

/**
 * SIP calling extension assigned to the user, returned by the backend on
 * `POST /auth/signin` and `GET /auth/profile`. `credentials` is snake_case —
 * it is passed straight through to the SIP client (mirrors web
 * `boh-lead-magnet/src/features/auth/models` `UserCallingExtension`).
 */
export interface UserCallingExtension {
  id: string;
  userId: string;
  projectId: string;
  extension: string;
  credentials: {
    domain: string;
    password: string;
    sip_port?: number;
    username: string;
    sip_server: string;
    stun_server?: string;
    websocket_url?: string;
    /**
     * WebRTC ICE servers (STUN + TURN) served per user by the backend — the
     * only source the app uses, so a TURN secret rotation on the server never
     * needs an app rebuild.
     */
    ice_servers?: {
      urls: string | string[];
      username?: string;
      credential?: string;
    }[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string | null;
  phone?: string | null;
  userType?: string;
  accountStatus?: string;
  mfaEnabled?: boolean;
  notificationsEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  profile?: UserProfile | null;
  roles: Role[];
  permissions: Permission[];
  hasAllAccess: boolean;
  callingExtension?: UserCallingExtension | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface SigninRequest {
  identifier: string;
  password: string;
  includeUserData?: boolean;
  keepMeLoggedIn?: boolean;
}

export interface MfaRequiredResponse {
  requiresMfa: true;
  tempToken: string;
  keepMeLoggedIn: boolean;
}

export interface SigninSuccessResponse {
  user: User;
  tokens: AuthTokens;
}

export interface ReactivationRequiredResponse {
  requiresReactivation: true;
  email: string;
  resendAvailableAt?: string;
}

export type SigninResponse =
  | MfaRequiredResponse
  | ReactivationRequiredResponse
  | SigninSuccessResponse;

export interface ReactivateOtpRequest {
  email: string;
  code: string;
  keepMeLoggedIn?: boolean;
}

export interface MfaVerifyRequest {
  tempToken: string;
  token: string;
  includeUserData?: boolean;
  keepMeLoggedIn?: boolean;
}

export interface MfaGenerateResponse {
  secret: string;
  qrCodeDataUrl: string;
  otpAuthUrl: string;
  backupCodes: string[];
}

export interface MfaEnableRequest {
  secret: string;
  token: string;
  backupCodes: string[];
}

export interface MfaEnableResponse {
  message: string;
}

export interface MfaStatusResponse {
  mfaEnabled: boolean;
  hasBackupCodes: boolean;
  enabledAt: string | null;
}

export interface MfaDisableRequest {
  token: string;
}

export interface MfaDisableResponse {
  message: string;
}

export interface MfaRegenerateBackupCodesRequest {
  token: string;
}

export interface MfaRegenerateBackupCodesResponse {
  backupCodes: string[];
}

export interface SignupRequest {
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  /** ISO `yyyy-MM-dd`. */
  dateOfBirth?: string;
  termsAccepted?: boolean;
}

export interface SignupResponse {
  success: boolean;
  message: string;
  userId: string;
  resendAvailableAt?: string;
}

export interface VerifySignupOtpRequest {
  email: string;
  code: string;
}

export interface VerifySignupOtpResponse {
  success: true;
  token: string;
  /** ISO timestamp after which the set-password token is dead and OTP must be redone. */
  expiresAt: string;
}

export interface ResendSignupOtpResponse {
  message: string;
  isResend: boolean;
  resendAvailableAt?: string;
}

export interface SetPasswordRequest {
  token: string;
  password: string;
}

export interface SetPasswordResponse {
  message: string;
}
