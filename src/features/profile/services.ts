import { apiClient } from '@/lib/api';
import type { AuthTokens, User } from '@/types/auth.types';

export interface PickedImage {
  uri: string;
  name: string;
  mimeType: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profilePicture?: PickedImage | null;
}

export type UpdateProfileResponse = User & { tokens?: AuthTokens };

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResponse> {
  const fd = new FormData();
  if (input.firstName !== undefined) fd.append('firstName', input.firstName);
  if (input.lastName !== undefined) fd.append('lastName', input.lastName);
  if (input.phone !== undefined) fd.append('phone', input.phone);
  if (input.profilePicture) {
    fd.append('profilePicture', {
      uri: input.profilePicture.uri,
      name: input.profilePicture.name,
      type: input.profilePicture.mimeType,
    } as unknown as Blob);
  }
  const { data } = await apiClient.patch<UpdateProfileResponse>('/api/v1/auth/profile', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export interface DeleteInfo {
  requiresPassword: boolean;
  appleLinked: boolean;
  googleLinked: boolean;
}

/** Re-auth proof the server needs before deleting — drives the delete screen UI. */
export async function getDeleteInfo(): Promise<DeleteInfo> {
  const { data } = await apiClient.get<DeleteInfo>('/api/v1/auth/account/delete-info');
  return data;
}

/** Exactly one proof, matching how the account signs in. */
export interface DeleteAccountPayload {
  password?: string;
  appleIdentityToken?: string;
  appleAuthorizationCode?: string;
  googleIdToken?: string;
}

export async function deleteAccount(payload: DeleteAccountPayload): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>('/api/v1/auth/account', {
    data: payload,
  });
  return data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  currentRefreshToken: string,
): Promise<UpdateProfileResponse> {
  const fd = new FormData();
  fd.append('currentPassword', currentPassword);
  fd.append('newPassword', newPassword);
  const { data } = await apiClient.patch<UpdateProfileResponse>('/api/v1/auth/profile', fd, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'x-refresh-token': currentRefreshToken,
    },
  });
  return data;
}
