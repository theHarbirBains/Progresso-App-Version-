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

/** AI Food Search's one estimate for a free-text description (e.g. "100
 * grams of air fried potatoes with no oil") -- every field is the model's
 * single best guess, not a fetched/verified figure. Through the backend,
 * never direct-to-Supabase: this calls a third-party API (Anthropic), the
 * exact kind of integration CLAUDE.md's hybrid architecture rule reserves
 * for the backend. */
export interface NutritionEstimate {
  name: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function estimateNutrition(
  accessToken: string,
  description: string,
): Promise<NutritionEstimate> {
  return request<NutritionEstimate>('/api/v1/foods/estimate', accessToken, {
    method: 'POST',
    body: JSON.stringify({ description }),
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
        topSets: { exerciseId: string; exerciseName: string; weightKg: number; reps: number }[];
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
