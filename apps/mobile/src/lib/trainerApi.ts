import type { HeightUnit } from './profileApi';
import { request } from './apiClient';

// Trainer mode (workouts only) -- see apps/api/src/trainer and
// docs/proposals/trainer-mode/README.md. Every call goes through the backend,
// which checks the Trainer subscription and the client link before acting.
export type TrainerLinkSource = 'managed' | 'linked';

export interface TrainerClient {
  /** null for an invite whose person has not signed in yet. */
  clientId: string | null;
  inviteId: string | null;
  /** Only set for an invite: the address the trainer typed. */
  email: string | null;
  status: 'invited' | 'pending' | 'active';
  /** A tracked client with no account yet: their history waits for a claim code. */
  awaitingClaim: boolean;
  source: TrainerLinkSource;
  displayName: string | null;
  birthday: string | null;
  heightValue: number | null;
  heightUnit: HeightUnit;
  weightValue: number | null;
  weightUnit: 'kg' | 'lb';
}

export interface TrainerProfileInput {
  displayName?: string;
  birthday?: string;
  heightValue?: number;
  heightUnit?: HeightUnit;
  weightValue?: number;
  weightUnit?: 'kg' | 'lb';
}

export interface TrainerRequest {
  trainerId: string;
  trainerDisplayName: string | null;
  requestedAt: string;
}

export interface TrainerActivity {
  id: string;
  trainerId: string;
  clientId: string | null;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  /** Who did the action. Null if that account has no display name. */
  trainerName: string | null;
  /** Who the action was about. Null for an action with no client. */
  clientName: string | null;
}

export interface LoggedSetInput {
  setIndex: number;
  side: 'none' | 'left' | 'right';
  weightKg: number;
  reps: number;
}

export interface LogWorkoutForClientInput {
  name: string;
  performedAt: string;
  completedAt?: string;
  exercises: { exerciseId: string; sets: LoggedSetInput[] }[];
}

export function getTrainerStatus(accessToken: string): Promise<{ isTrainer: boolean }> {
  return request<{ isTrainer: boolean }>('/api/v1/trainer/status', accessToken);
}

export function listTrainerClients(accessToken: string): Promise<TrainerClient[]> {
  return request<TrainerClient[]>('/api/v1/trainer/clients', accessToken);
}

/** The answer to adding a client. An email invite is identical whether or not the address has an account. */
export type AddTrainerClientResult =
  | { kind: 'request'; status: 'pending' | 'active'; clientId: string }
  | { kind: 'invite'; status: 'invited' };

/** Give exactly one of a username (an existing account gets a request) or an email (an invite). */
export function addTrainerClient(
  accessToken: string,
  input: TrainerProfileInput & { username?: string; email?: string },
): Promise<AddTrainerClientResult> {
  return request<AddTrainerClientResult>(`/api/v1/trainer/clients`, accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Attaches invites sent to this person's confirmed email. Called at sign-in. */
export function claimTrainerInvites(accessToken: string): Promise<{ claimed: number }> {
  return request<{ claimed: number }>('/api/v1/trainer/invites/claim', accessToken, {
    method: 'POST',
  });
}

export function updateTrainerClientProfile(
  accessToken: string,
  clientId: string,
  input: TrainerProfileInput,
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/trainer/clients/${encodeURIComponent(clientId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function endTrainerClient(accessToken: string, clientId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/trainer/clients/${encodeURIComponent(clientId)}/end`,
    accessToken,
    { method: 'POST' },
  );
}

export function logWorkoutForClient(
  accessToken: string,
  clientId: string,
  input: LogWorkoutForClientInput,
): Promise<{ workoutId: string }> {
  return request<{ workoutId: string }>(
    `/api/v1/trainer/clients/${encodeURIComponent(clientId)}/workouts`,
    accessToken,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listTrainerRequests(accessToken: string): Promise<TrainerRequest[]> {
  return request<TrainerRequest[]>('/api/v1/trainer/requests', accessToken);
}

export function listMyTrainers(accessToken: string): Promise<TrainerRequest[]> {
  return request<TrainerRequest[]>('/api/v1/trainer/trainers', accessToken);
}

export function respondToTrainerRequest(
  accessToken: string,
  trainerId: string,
  action: 'accept' | 'decline',
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/trainer/requests/${encodeURIComponent(trainerId)}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    },
  );
}

/** The client ends a link with one of their trainers. */
export function endTrainerLink(accessToken: string, trainerId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/trainer/links/${encodeURIComponent(trainerId)}/end`,
    accessToken,
    { method: 'POST' },
  );
}

export function listTrainerActivity(accessToken: string): Promise<TrainerActivity[]> {
  return request<TrainerActivity[]>('/api/v1/trainer/actions', accessToken);
}

/** A client tracked before they have an account. The code is shown once, to give to the client. */
export function trackTrainerClient(
  accessToken: string,
  input: {
    displayName: string;
    birthday?: string;
    heightValue?: number;
    heightUnit?: HeightUnit;
    weightValue?: number;
    weightUnit?: 'kg' | 'lb';
  },
): Promise<{ clientId: string; claimCode: string; expiresAt: string }> {
  return request<{ clientId: string; claimCode: string; expiresAt: string }>(
    '/api/v1/trainer/tracked-clients',
    accessToken,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

/** A new claim code for a tracked client. The old one stops working at once. */
export function regenerateTrainerClaimCode(
  accessToken: string,
  clientId: string,
): Promise<{ claimCode: string; expiresAt: string }> {
  return request<{ claimCode: string; expiresAt: string }>(
    `/api/v1/trainer/clients/${encodeURIComponent(clientId)}/claim-code`,
    accessToken,
    { method: 'POST' },
  );
}

/** The client enters the code their trainer gave them. Their tracked history moves onto their account. */
export function claimTrainerHistory(
  accessToken: string,
  code: string,
): Promise<{ workouts: number }> {
  return request<{ workouts: number }>('/api/v1/trainer/history/claim', accessToken, {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

// Trainer live sessions for a client: started, added to as it happens, and finished by the trainer.
export function startLiveWorkout(
  accessToken: string,
  clientId: string,
  name: string,
): Promise<{ workoutId: string }> {
  return request<{ workoutId: string }>(
    `/api/v1/trainer/clients/${encodeURIComponent(clientId)}/live-workouts`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ name }) },
  );
}

export function finishLiveWorkout(
  accessToken: string,
  clientId: string,
  workoutId: string,
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/trainer/clients/${encodeURIComponent(clientId)}/live-workouts/${encodeURIComponent(workoutId)}/finish`,
    accessToken,
    { method: 'POST' },
  );
}

/** Discards a live session. Nothing from it is kept. */
export function cancelLiveWorkout(
  accessToken: string,
  clientId: string,
  workoutId: string,
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/trainer/clients/${encodeURIComponent(clientId)}/live-workouts/${encodeURIComponent(workoutId)}/cancel`,
    accessToken,
    { method: 'POST' },
  );
}

/** The exercise id to use in a client's live session (the client's own copy of a trainer's exercise). */
export function resolveClientExercise(
  accessToken: string,
  clientId: string,
  exerciseId: string,
): Promise<{ exerciseId: string }> {
  return request<{ exerciseId: string }>(
    `/api/v1/trainer/clients/${encodeURIComponent(clientId)}/exercises/resolve`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ exerciseId }) },
  );
}
