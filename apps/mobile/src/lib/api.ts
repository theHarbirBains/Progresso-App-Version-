// Thin client for the backend API — the only place profile writes go
// through (see PATCH /users/me), never a direct Supabase client update,
// so username uniqueness/validation stays centrally enforced server-side.
export interface ProfileResponse {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  username: string | null;
  weightUnit: 'kg' | 'lb';
}

export interface UpdateProfileInput {
  displayName?: string;
  username?: string;
  weightUnit?: 'kg' | 'lb';
}

function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_BASE_URL. Copy apps/mobile/.env.example to apps/mobile/.env and fill in your backend URL.',
    );
  }
  return url;
}

function extractErrorMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return 'Request failed';
}

async function request<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(body));
  }

  return body as T;
}

export function getMyProfile(accessToken: string): Promise<ProfileResponse> {
  return request<ProfileResponse>('/api/v1/users/me', accessToken);
}

export function updateMyProfile(
  accessToken: string,
  updates: UpdateProfileInput,
): Promise<ProfileResponse> {
  return request<ProfileResponse>('/api/v1/users/me', accessToken, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}
