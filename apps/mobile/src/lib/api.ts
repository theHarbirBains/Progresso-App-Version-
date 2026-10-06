import type { LoggingStyle, MovementType } from '../exercises/movementTypes';
import type { MuscleGroup } from '../exercises/muscleGroups';

// Thin client for the backend API — the only place profile writes go
// through (see PATCH /users/me), never a direct Supabase client update,
// so username uniqueness/validation stays centrally enforced server-side.
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type HeightUnit = 'cm' | 'ft_in';
export type FitnessGoal =
  | 'build_muscle'
  | 'get_stronger'
  | 'lose_fat'
  | 'improve_fitness'
  | 'improve_athletic_performance'
  | 'maintain_fitness'
  | 'general_health'
  | 'other';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';
export type TrainingStylePreference = 'guided' | 'build_your_own';
export type AppleHealthPreference = 'connected' | 'not_now';
/** The 5 Mifflin-St Jeor activity-multiplier tiers -- see
 * nutrition/calorieEstimationInput.ts's ACTIVITY_LEVELS for the labeled/
 * described catalog built on this same type. */
export type ActivityLevel =
  'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
export type ReferralSource =
  'tiktok' | 'instagram' | 'friend' | 'app_store' | 'google_search' | 'creator' | 'other';
export type AverageWorkoutLength = '20_30' | '30_45' | '45_60' | '60_plus';

export interface ProfileResponse {
  id: string;
  email: string;
  role: string;
  displayName: string | null;
  username: string | null;
  weightUnit: 'kg' | 'lb';
  workoutAccentColor: string | null;
  nutritionAccentColor: string | null;
  backgroundTheme: string | null;
  avatarUrl: string | null;
  activeWorkoutSplitId: string | null;
  gender: Gender | null;
  birthday: string | null;
  weightValue: number | null;
  heightValue: number | null;
  heightUnit: HeightUnit;
  fitnessGoal: FitnessGoal | null;
  trainingExperience: TrainingExperience | null;
  workoutFrequencyDays: number | null;
  trainingStylePreference: TrainingStylePreference | null;
  emailOptIn: boolean | null;
  pushNotificationsOptIn: boolean | null;
  appleHealthPreference: AppleHealthPreference | null;
  onboardingCompletedAt: string | null;
  activityLevel: ActivityLevel | null;
  referralSource: ReferralSource | null;
  /** ISO 3166-1 alpha-2, e.g. "CA" -- purely informational, nothing else reads it. */
  country: string | null;
  averageWorkoutLength: AverageWorkoutLength | null;
}

export interface UpdateProfileInput {
  displayName?: string;
  username?: string;
  weightUnit?: 'kg' | 'lb';
  workoutAccentColor?: string;
  nutritionAccentColor?: string;
  backgroundTheme?: string;
  /** Explicit null clears the picture (reverts to the fallback avatar); omit to leave it untouched. */
  avatarUrl?: string | null;
  activeWorkoutSplitId?: string;
  gender?: Gender;
  birthday?: string;
  weightValue?: number;
  heightValue?: number;
  heightUnit?: HeightUnit;
  fitnessGoal?: FitnessGoal;
  trainingExperience?: TrainingExperience;
  workoutFrequencyDays?: number;
  trainingStylePreference?: TrainingStylePreference;
  emailOptIn?: boolean;
  pushNotificationsOptIn?: boolean;
  appleHealthPreference?: AppleHealthPreference;
  onboardingCompleted?: boolean;
  activityLevel?: ActivityLevel;
  referralSource?: ReferralSource;
  country?: string;
  averageWorkoutLength?: AverageWorkoutLength;
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
    // The backend's global exception filter wraps NestJS's own exception
    // response (e.g. { message: 'Missing bearer token', error, statusCode })
    // under this outer message field, so a real error surfaces one level
    // deeper than a plain HttpException response would.
    if (message && typeof message === 'object' && 'message' in message) {
      const nested = (message as { message: unknown }).message;
      if (typeof nested === 'string') return nested;
    }
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

// Exercise writes (create/edit/deactivate) go through the backend for the
// same reason profile writes do: centralized validation and a clean 409 on
// a duplicate custom-exercise name instead of a raw Postgres error. Reads
// (search/list/filter) go direct to Supabase instead — see exerciseQueries.
export interface ExerciseResponse {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  movementType: MovementType;
  loggingStyle: LoggingStyle | null;
  photoUrl: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExerciseInput {
  name: string;
  muscleGroup: MuscleGroup;
  movementType: MovementType;
  /** Required when movementType is 'unilateral', omitted otherwise -- see ExerciseFormScreen. */
  loggingStyle?: LoggingStyle;
  photoUrl?: string;
}

export interface UpdateExerciseInput {
  name?: string;
  muscleGroup?: MuscleGroup;
  movementType?: MovementType;
  loggingStyle?: LoggingStyle;
  isActive?: boolean;
  /** Omit to leave the stored photo alone; null clears it, a string sets/replaces it -- editable any time, not just at create. */
  photoUrl?: string | null;
}

export function createExercise(
  accessToken: string,
  input: CreateExerciseInput,
): Promise<ExerciseResponse> {
  return request<ExerciseResponse>('/api/v1/exercises', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateExercise(
  accessToken: string,
  id: string,
  input: UpdateExerciseInput,
): Promise<ExerciseResponse> {
  return request<ExerciseResponse>(`/api/v1/exercises/${id}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

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

// Food search combines Progresso's own cached catalog with a live external
// provider (Open Food Facts) call on the backend -- never called directly
// from the mobile app, since that orchestration (provider call, dedup-safe
// caching) is real business logic, not a simple RLS-protected read. See
// apps/api/src/foods/.
export interface FoodSearchResult {
  id: string;
  name: string;
  brand: string | null;
  /** Null when the provider has no product photo -- never a placeholder image. */
  imageUrl: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  /** Null when the provider genuinely didn't report this macro -- never a fabricated 0. */
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** Null for Progresso's own generic/seeded foods; the source provider's id (e.g. 'open_food_facts') for a cached branded product. */
  provider: string | null;
  barcode: string | null;
}

export interface FoodSearchResponse {
  foods: FoodSearchResult[];
  hasMore: boolean;
}

export function searchFoods(
  accessToken: string,
  query: string,
  page = 0,
  pageSize = 30,
): Promise<FoodSearchResponse> {
  const params = new URLSearchParams({ query, page: String(page), pageSize: String(pageSize) });
  return request<FoodSearchResponse>(`/api/v1/foods/search?${params.toString()}`, accessToken);
}

/**
 * Scan Barcode's lookup step -- same provider-orchestration reasoning as
 * searchFoods (through the backend, never direct-to-Supabase). Resolves to
 * `null` (not a thrown error) when the product genuinely isn't found: a
 * missing barcode is Open Food Facts' normal "no match" outcome, not a
 * failure, so the backend returns a plain 200 with a null body for it (see
 * apps/api/src/foods/foods.controller.ts) -- only a real network/server
 * failure throws here, same as any other request() call.
 */
export function getFoodByBarcode(
  accessToken: string,
  barcode: string,
): Promise<FoodSearchResult | null> {
  return request<FoodSearchResult | null>(
    `/api/v1/foods/barcode/${encodeURIComponent(barcode)}`,
    accessToken,
  );
}

/** AI Food Search. The backend parses a description, then resolves each component against the
 * best source for it. Every component reports its own state, so a pending one can be resolved
 * without restarting the search. Figures come from data; an AI estimate is labelled as such.
 * Through the backend because it calls third-party services. */
export interface QuantityOption {
  label: string;
  amount: number;
  unit: string;
}

export interface Choice {
  sourceKind: 'progresso_catalog' | 'open_food_facts' | 'usda_fdc';
  sourceId: string;
  matchedName: string;
  brand: string | null;
  score: number;
  reasons: string[];
}

export interface ComponentRequest {
  index: number;
  role: 'main' | 'ingredient';
  name: string;
  term: string;
  brand: string | null;
  barcode: string | null;
  quantity: { amount: number; unit: string } | null;
}

export interface ComponentPick {
  sourceKind: Choice['sourceKind'];
  sourceId: string;
}

export interface NutrientFigures {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ResolvedComponentFigures {
  name: string;
  quantity: { amount: number; unit: string };
  grams: number | null;
  nutrients: NutrientFigures;
  provenance: {
    confidence: 'verified' | 'calculated' | 'ai_estimate' | 'user_entered';
    sourceKind: string | null;
    sourceId: string | null;
    matchedName: string | null;
    brand: string | null;
    dataVersion: string | null;
    retrievedAt: string | null;
    licence: string;
    attribution: string | null;
    assumptions: string[];
  };
}

export type ComponentStatus =
  | { state: 'resolved'; request: ComponentRequest; component: ResolvedComponentFigures }
  | { state: 'ai_estimate'; request: ComponentRequest; component: ResolvedComponentFigures }
  | {
      state: 'needs_quantity';
      request: ComponentRequest;
      matchedName: string | null;
      options: QuantityOption[];
      reason: string;
    }
  | { state: 'choose'; request: ComponentRequest; choices: Choice[] }
  | { state: 'not_found'; request: ComponentRequest; reason: string };

export interface FoodInterpretation {
  name: string;
  preparation: string | null;
  components: ComponentStatus[];
  complete: boolean;
  servingSize: number | null;
  servingUnit: string | null;
  totals: NutrientFigures | null;
  hasEstimate: boolean;
}

export type InterpretFoodResponse =
  | { status: 'clarification'; question: string }
  | { status: 'ok'; interpretation: FoodInterpretation };

export function interpretFoodDescription(
  accessToken: string,
  description: string,
): Promise<InterpretFoodResponse> {
  return request<InterpretFoodResponse>('/api/v1/foods/interpret', accessToken, {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}

/** Resolves one pending component: after the user picks a candidate, or gives an amount. */
export function resolveFoodComponent(
  accessToken: string,
  componentRequest: ComponentRequest,
  pick: ComponentPick | null,
): Promise<ComponentStatus> {
  return request<ComponentStatus>('/api/v1/foods/resolve-component', accessToken, {
    method: 'POST',
    body: JSON.stringify({ request: componentRequest, pick }),
  });
}

// Real push notification delivery (Expo push service) -- through the
// backend, never direct-to-Supabase: registering a device token and
// actually sending are real server-side orchestration (see
// apps/api/src/notifications/). iOS only for now -- see
// pushNotifications.ts, which never calls these on Android.
export function registerPushToken(
  accessToken: string,
  expoPushToken: string,
  platform: 'ios' | 'android',
): Promise<{ registered: true }> {
  return request<{ registered: true }>('/api/v1/notifications/push-token', accessToken, {
    method: 'POST',
    body: JSON.stringify({ expoPushToken, platform }),
  });
}

export function unregisterPushToken(
  accessToken: string,
  expoPushToken: string,
): Promise<{ removed: true }> {
  return request<{ removed: true }>('/api/v1/notifications/push-token', accessToken, {
    method: 'DELETE',
    body: JSON.stringify({ expoPushToken }),
  });
}

// Social v1: a one-directional, accept-gated follow graph -- see
// apps/api/src/follows for why every call here goes through the backend
// (reading another user's username/display name/workouts/food logs is
// exactly the cross-user-trusted read direct-to-Supabase RLS doesn't allow).
export type FollowStatus = 'none' | 'pending' | 'accepted';

export interface FollowUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FollowRequest {
  followId: string;
  user: FollowUser;
  createdAt: string;
}

export interface FollowSearchResult {
  user: FollowUser;
  status: FollowStatus;
}

export function searchUsers(accessToken: string, query: string): Promise<FollowSearchResult[]> {
  const params = new URLSearchParams({ query });
  return request<FollowSearchResult[]>(`/api/v1/follows/search?${params.toString()}`, accessToken);
}

export function listFollowRequests(accessToken: string): Promise<FollowRequest[]> {
  return request<FollowRequest[]>('/api/v1/follows/requests', accessToken);
}

/** "N athletes to follow" -- see FollowsService.listSuggested. Recency-ranked, not a fabricated "you may know" algorithm. */
export function listSuggestedUsers(accessToken: string): Promise<FollowSearchResult[]> {
  return request<FollowSearchResult[]>('/api/v1/follows/suggested', accessToken);
}

export function listFollowing(accessToken: string): Promise<FollowUser[]> {
  return request<FollowUser[]>('/api/v1/follows/following', accessToken);
}

// The notifications bell's Activity section: pending requests plus follows
// you sent that were accepted recently, merged and sorted server-side (see
// FollowsService.listNotifications) -- distinct from listFollowRequests,
// which stays the full management list for Find People's Requests tab.
export type FollowNotification =
  | { kind: 'request'; followId: string; user: FollowUser; at: string }
  | { kind: 'accepted'; followId: string; user: FollowUser; at: string };

export function listFollowNotifications(accessToken: string): Promise<FollowNotification[]> {
  return request<FollowNotification[]>('/api/v1/follows/notifications', accessToken);
}

export function sendFollowRequest(
  accessToken: string,
  targetUserId: string,
): Promise<{ status: FollowStatus }> {
  return request<{ status: FollowStatus }>(
    `/api/v1/follows/${encodeURIComponent(targetUserId)}`,
    accessToken,
    { method: 'POST' },
  );
}

export function respondToFollowRequest(
  accessToken: string,
  followId: string,
  action: 'accept' | 'reject',
): Promise<{ success: true }> {
  return request<{ success: true }>(
    `/api/v1/follows/requests/${encodeURIComponent(followId)}`,
    accessToken,
    { method: 'PATCH', body: JSON.stringify({ action }) },
  );
}

export function unfollowUser(
  accessToken: string,
  targetUserId: string,
): Promise<{ success: true }> {
  return request<{ success: true }>(
    `/api/v1/follows/${encodeURIComponent(targetUserId)}`,
    accessToken,
    { method: 'DELETE' },
  );
}

// The Friends tab of Feed -- accepted followees' own completed workouts and
// logged foods, merged server-side (apps/api/src/feed) the same way
// feedQueries.ts merges "my" feed client-side. Each item carries its
// author's public profile fields, since (unlike the self-feed) the byline
// isn't always the signed-in user.
export type FriendsFeedItem =
  | {
      kind: 'workout';
      id: string;
      timestamp: string;
      author: FollowUser;
      workout: {
        id: string;
        name: string;
        splitDayName: string | null;
        muscleGroups: string[];
        durationMinutes: number | null;
        exerciseCount: number;
        completedSetCount: number;
        totalVolumeKg: number;
        completedExerciseCount: number;
        topSets: {
          exerciseId: string;
          exerciseName: string;
          photoUrl: string | null;
          weightKg: number;
          reps: number;
        }[];
      };
    }
  | {
      kind: 'foodLog';
      id: string;
      timestamp: string;
      author: FollowUser;
      log: {
        id: string;
        foodNameSnapshot: string;
        calories: number;
        proteinG: number;
        carbsG: number;
        fatG: number;
        mealType: string | null;
        imageUrl: string | null;
      };
    };

export interface FriendsFeedPage {
  items: FriendsFeedItem[];
  hasMore: boolean;
}

export function fetchFriendsFeed(accessToken: string, page = 0): Promise<FriendsFeedPage> {
  const params = new URLSearchParams({ page: String(page) });
  return request<FriendsFeedPage>(`/api/v1/feed/friends?${params.toString()}`, accessToken);
}

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

// Group workouts (see apps/api/src/groups). Friends, clients and guests can be in a group;
// every joined member can read and edit every group workout's exercises and sets.
export interface GroupSummary {
  id: string;
  name: string;
  hostId: string;
  startedAt: string;
  myRole: 'host' | 'member';
}

export interface GroupMember {
  userId: string;
  displayName: string | null;
  role: 'host' | 'member';
  status: 'invited' | 'joined';
  isGuest: boolean;
  /** This member's workout in the group, or null while they are only invited. */
  workoutId: string | null;
}

export interface GroupDetail {
  id: string;
  name: string;
  status: 'live' | 'finished';
  hostId: string;
  startedAt: string;
  finishedAt: string | null;
  members: GroupMember[];
}

export interface GroupInvite {
  groupId: string;
  name: string;
  hostDisplayName: string | null;
  invitedAt: string;
}

export function createGroup(
  accessToken: string,
  input: { name: string; workoutId?: string },
): Promise<{ groupId: string }> {
  return request<{ groupId: string }>('/api/v1/groups', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listGroups(accessToken: string): Promise<GroupSummary[]> {
  return request<GroupSummary[]>('/api/v1/groups', accessToken);
}

export function listGroupInvites(accessToken: string): Promise<GroupInvite[]> {
  return request<GroupInvite[]>('/api/v1/groups/invites', accessToken);
}

export function getGroup(accessToken: string, groupId: string): Promise<GroupDetail> {
  return request<GroupDetail>(`/api/v1/groups/${encodeURIComponent(groupId)}`, accessToken);
}

export function inviteToGroup(
  accessToken: string,
  groupId: string,
  username: string,
): Promise<{ userId: string; status: 'invited' | 'joined' }> {
  return request(`/api/v1/groups/${encodeURIComponent(groupId)}/members`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export function addGroupGuest(
  accessToken: string,
  groupId: string,
  displayName: string,
): Promise<{ userId: string }> {
  return request(`/api/v1/groups/${encodeURIComponent(groupId)}/guests`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export function respondToGroupInvite(
  accessToken: string,
  groupId: string,
  action: 'accept' | 'decline',
): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/groups/${encodeURIComponent(groupId)}/invite`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    },
  );
}

export function finishGroup(accessToken: string, groupId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(
    `/api/v1/groups/${encodeURIComponent(groupId)}/finish`,
    accessToken,
    {
      method: 'POST',
    },
  );
}

export function leaveGroup(accessToken: string, groupId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/v1/groups/${encodeURIComponent(groupId)}/leave`, accessToken, {
    method: 'POST',
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
