import { request } from './apiClient';

// Equipment profiles are purely descriptive/contextual today -- see the
// equipment_profiles migration. Only creation exists so far, from the New
// Exercise screen; there's no list/edit/delete UI yet.
export interface EquipmentProfileResponse {
  id: string;
  exerciseId: string;
  name: string;
  gym: string | null;
  photoUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEquipmentProfileInput {
  exerciseId: string;
  name: string;
  gym?: string;
  photoUrl?: string;
}

export function createEquipmentProfile(
  accessToken: string,
  input: CreateEquipmentProfileInput,
): Promise<EquipmentProfileResponse> {
  return request<EquipmentProfileResponse>('/api/v1/equipment-profiles', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
