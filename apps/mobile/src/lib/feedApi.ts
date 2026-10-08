import type { FollowUser } from './followsApi';
import { request } from './apiClient';

// The Friends tab of Feed -- accepted followees' own completed workouts,
// merged server-side (apps/api/src/feed) the same way feedQueries.ts merges
// "my" feed client-side. Each item carries its author's public profile
// fields, since (unlike the self-feed) the byline isn't always the signed-in
// user. Nutrition logs are deliberately not part of Feed -- see Nutrition
// Today/History for logged food instead.
export type FriendsFeedItem = {
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
};

export interface FriendsFeedPage {
  items: FriendsFeedItem[];
  hasMore: boolean;
}

export function fetchFriendsFeed(accessToken: string, page = 0): Promise<FriendsFeedPage> {
  const params = new URLSearchParams({ page: String(page) });
  return request<FriendsFeedPage>(`/api/v1/feed/friends?${params.toString()}`, accessToken);
}
