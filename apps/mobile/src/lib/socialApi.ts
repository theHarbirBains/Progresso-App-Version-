import type { MeasurementType } from '../exercises/movementTypes';
import { request } from './apiClient';
import type { FriendsFeedPage } from './feedApi';
import type { FollowSearchResult, FollowStatus, FollowUser } from './followsApi';

// Profiles, follower lists, finding friends from contacts, a followed person's workout, and
// likes and comments -- see apps/api/src/social. All through the API: they read other people's
// data, which only the server may decide to show (follows accepted, blocks either way).

/** An exercise as a profile shows it: what it is, which machine, and what its sets record. */
export interface ExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  photoUrl: string | null;
  gym: string | null;
  attachment: string | null;
  measurementType: MeasurementType;
}

/**
 * An exercise they've done, with its best set: the heaviest (weightKg x reps) for weights, the
 * most reps for bodyweight, the longest (durationSeconds) for timed.
 */
export interface ExerciseBest extends ExerciseSummary {
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  performedAt: string;
  /** How many workouts it's in. */
  workouts: number;
  lastPerformedAt: string;
}

/** A workout's top set on one exercise. */
export interface TopSet {
  workoutId: string;
  performedAt: string;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

/** One exercise of theirs: each workout's top set, newest first, and the records they hold. */
export interface PersonExercise {
  exercise: ExerciseSummary;
  topSets: TopSet[];
  /** The heaviest at each rep count from 2 up, fewest reps first. */
  repPRs: { reps: number; weightKg: number; achievedAt: string }[];
  /** True 1RM: only ever a logged single. */
  oneRepMax: { weightKg: number; achievedAt: string } | null;
  mostReps: { reps: number; achievedAt: string } | null;
  longest: { durationSeconds: number; achievedAt: string } | null;
}

export interface ProfileStats {
  /** Finished workouts in all, and in the last 30 days. */
  workouts: number;
  lastThirtyDays: number;
  /** Everything lifted: each finished weighted set's weight x reps. */
  totalVolumeKg: number;
  /** Rep-count PRs and true 1RMs held now. */
  prCount: number;
  /** The most workouts finished in one calendar month. */
  bestMonthWorkouts: number;
}

export interface PersonProfile {
  user: FollowUser;
  isSelf: boolean;
  /** Your follow of them. */
  followStatus: FollowStatus;
  /** Their accepted follow of you. */
  followsYou: boolean;
  /** Their request to follow you, waiting for your answer. */
  requestId: string | null;
  followerCount: number;
  followingCount: number;
  /** Their last name, after their first (user.displayName) -- null with none. */
  lastName: string | null;
  /** A line about themselves -- null with none. */
  bio: string | null;
  /** The people you follow who follow them too: how many, and up to 50 of them. */
  mutuals: { count: number; people: FollowUser[] };
  /** Whether you can see their workouts, stats and lifts: yours, or they accepted your follow. */
  canSeeActivity: boolean;
  stats: ProfileStats | null;
  /** Every exercise they've done, with its best set, the most-done first. */
  exercises: ExerciseBest[] | null;
  /** Their lifetime AP -- null when they hide their rank (never on your own). */
  rank: { points: number; awards: number } | null;
  /** The achievements they've earned, the latest first -- once their follow is accepted. */
  achievements: EarnedAchievement[] | null;
}

/** An achievement someone's earned, as their profile lists it -- never a nutrition one. */
export interface EarnedAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  kind: 'single' | 'levels';
  /** The level reached, out of how many there are (1 of 1 for a single unlock). */
  level: number;
  levels: number;
  /** The AP every level reached has brought. */
  ap: number;
  firstAwardedAt: string;
  lastAwardedAt: string;
}

export function getPersonProfile(accessToken: string, personId: string): Promise<PersonProfile> {
  return request<PersonProfile>(`/api/v1/people/${encodeURIComponent(personId)}`, accessToken);
}

/** One exercise of theirs: its top set from each workout, and the records they hold on it. */
export function getPersonExercise(
  accessToken: string,
  personId: string,
  exerciseId: string,
): Promise<PersonExercise> {
  return request<PersonExercise>(
    `/api/v1/people/${encodeURIComponent(personId)}/exercises/${encodeURIComponent(exerciseId)}`,
    accessToken,
  );
}

/** A page of their finished workouts, as the Friends feed shows them. */
export function getPersonWorkouts(
  accessToken: string,
  personId: string,
  page = 0,
): Promise<FriendsFeedPage> {
  return request<FriendsFeedPage>(
    `/api/v1/people/${encodeURIComponent(personId)}/workouts?page=${page}`,
    accessToken,
  );
}

export function listPersonFollowers(
  accessToken: string,
  personId: string,
): Promise<FollowSearchResult[]> {
  return request<FollowSearchResult[]>(
    `/api/v1/people/${encodeURIComponent(personId)}/followers`,
    accessToken,
  );
}

export function listPersonFollowing(
  accessToken: string,
  personId: string,
): Promise<FollowSearchResult[]> {
  return request<FollowSearchResult[]>(
    `/api/v1/people/${encodeURIComponent(personId)}/following`,
    accessToken,
  );
}

/** The people on Progresso with one of these hashed contact emails (social/contactEmails.ts). */
export function matchContacts(
  accessToken: string,
  hashes: string[],
): Promise<FollowSearchResult[]> {
  return request<FollowSearchResult[]>('/api/v1/people/contacts', accessToken, {
    method: 'POST',
    body: JSON.stringify({ hashes }),
  });
}

export interface FriendWorkoutSet {
  id: string;
  setIndex: number;
  side: 'left' | 'right' | null;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  completedAt: string | null;
}

/** A followed person's finished workout, to read. */
export interface FriendWorkout {
  id: string;
  name: string;
  performedAt: string;
  completedAt: string | null;
  author: FollowUser;
  exercises: {
    id: string;
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    movementType: string;
    measurementType: string;
    photoUrl: string | null;
    gym: string | null;
    attachment: string | null;
    orderIndex: number;
    sets: FriendWorkoutSet[];
  }[];
}

export function getFriendWorkout(accessToken: string, workoutId: string): Promise<FriendWorkout> {
  return request<FriendWorkout>(`/api/v1/workouts/${encodeURIComponent(workoutId)}`, accessToken);
}

export interface WorkoutComment {
  id: string;
  workoutId: string;
  user: FollowUser;
  body: string;
  createdAt: string;
  /** You wrote it, or it's on your workout. */
  canDelete: boolean;
}

export interface WorkoutSocial {
  likeCount: number;
  likedByMe: boolean;
  likers: FollowUser[];
  comments: WorkoutComment[];
}

export interface SocialSummary {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export function getWorkoutSocial(accessToken: string, workoutId: string): Promise<WorkoutSocial> {
  return request<WorkoutSocial>(
    `/api/v1/workouts/${encodeURIComponent(workoutId)}/social`,
    accessToken,
  );
}

/** Likes and comments on each of these workouts you can see (others are left out). */
export function getSocialSummary(
  accessToken: string,
  workoutIds: string[],
): Promise<Record<string, SocialSummary>> {
  return request<Record<string, SocialSummary>>('/api/v1/workouts/social-summary', accessToken, {
    method: 'POST',
    body: JSON.stringify({ workoutIds }),
  });
}

export function likeWorkout(accessToken: string, workoutId: string): Promise<null> {
  return request<null>(`/api/v1/workouts/${encodeURIComponent(workoutId)}/like`, accessToken, {
    method: 'PUT',
  });
}

export function unlikeWorkout(accessToken: string, workoutId: string): Promise<null> {
  return request<null>(`/api/v1/workouts/${encodeURIComponent(workoutId)}/like`, accessToken, {
    method: 'DELETE',
  });
}

export function postComment(
  accessToken: string,
  workoutId: string,
  body: string,
): Promise<WorkoutComment> {
  return request<WorkoutComment>(
    `/api/v1/workouts/${encodeURIComponent(workoutId)}/comments`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ body }) },
  );
}

export function deleteComment(accessToken: string, commentId: string): Promise<null> {
  return request<null>(`/api/v1/workouts/comments/${encodeURIComponent(commentId)}`, accessToken, {
    method: 'DELETE',
  });
}
