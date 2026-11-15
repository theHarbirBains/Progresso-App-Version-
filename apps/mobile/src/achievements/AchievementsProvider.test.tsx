import { act, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { useProfile } from '../profile/ProfileProvider';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import {
  awardMyAchievements,
  fetchAchievementDefinitions,
  fetchAchievementsSeenAt,
  fetchMyAwards,
  fetchMyProgress,
  markAchievementsSeen,
} from './achievementQueries';
import { useAchievements, type AchievementsValue } from './achievementsContext';
import { AchievementsProvider } from './AchievementsProvider';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../nutrition/FoodLogProvider', () => ({ useFoodLog: jest.fn() }));
jest.mock('../profile/ProfileProvider', () => ({ useProfile: jest.fn() }));
jest.mock('../progress/AllTimeStatsProvider', () => ({ useAllTimeStats: jest.fn() }));
jest.mock('./achievementQueries', () => ({
  fetchAchievementDefinitions: jest.fn(),
  fetchMyAwards: jest.fn(),
  fetchMyProgress: jest.fn(),
  fetchAchievementsSeenAt: jest.fn(),
  markAchievementsSeen: jest.fn(),
  awardMyAchievements: jest.fn(),
}));

const definition = (id: string, title: string) => ({
  id,
  category: 'workouts',
  kind: 'levels',
  title,
  description: `${title}, done`,
  icon: 'activity',
  metric: 'workouts',
  unit: 'count',
  goalLabel: 'workouts',
  visibility: 'public',
  sort: 10,
  levels: [{ level: 1, goal: 5, ap: 50 }],
});
const T0 = '2026-11-01T10:00:00.000Z';
const T1 = '2026-11-14T10:00:00.000Z';
const award = (id: string, ap: number, awardedAt: string, level = 1) => ({
  achievementId: id,
  level,
  ap,
  awardedAt,
});

let latest: AchievementsValue;
function Probe() {
  latest = useAchievements();
  return null;
}
const tree = () => (
  <AchievementsProvider>
    <Probe />
  </AchievementsProvider>
);

const stats = { allWorkouts: [] as unknown[], repPRs: [] as unknown[] };
const food = { logs: [] as unknown[] };
let profile = { onboardingCompletedAt: '2026-10-01T10:00:00Z' as string | null };
let appStateListeners: ((state: string) => void)[] = [];

beforeEach(() => {
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
    appStateListeners.push(cb as (state: string) => void);
    return { remove: jest.fn() } as never;
  });
  profile = { onboardingCompletedAt: '2026-10-01T10:00:00Z' };
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'me' } });
  (useAllTimeStats as jest.Mock).mockImplementation(() => stats);
  (useFoodLog as jest.Mock).mockImplementation(() => food);
  (useProfile as jest.Mock).mockImplementation(() => ({ profile }));
  (fetchAchievementDefinitions as jest.Mock)
    .mockReset()
    .mockResolvedValue([
      definition('iron-regular', 'Iron Regular'),
      definition('first-steps', 'First Steps'),
    ]);
  // You've already been shown your Iron Regular level.
  (fetchMyAwards as jest.Mock).mockReset().mockResolvedValue([award('iron-regular', 50, T0)]);
  (fetchMyProgress as jest.Mock)
    .mockReset()
    .mockResolvedValue([{ achievementId: 'iron-regular', value: 6, level: 1 }]);
  (fetchAchievementsSeenAt as jest.Mock).mockReset().mockResolvedValue(T0);
  (markAchievementsSeen as jest.Mock).mockReset().mockResolvedValue(undefined);
  (awardMyAchievements as jest.Mock).mockReset().mockResolvedValue([]);
});

describe('AchievementsProvider', () => {
  it('awards as you sign in, and shows what came in since you last looked', async () => {
    (fetchMyAwards as jest.Mock)
      .mockResolvedValueOnce([award('iron-regular', 50, T0)])
      .mockResolvedValue([award('iron-regular', 50, T0), award('first-steps', 25, T1)]);
    render(tree());

    await waitFor(() => expect(latest.points).toBe(75));
    expect(awardMyAchievements).toHaveBeenCalledTimes(1);
    expect(latest.progress).toEqual([{ achievementId: 'iron-regular', value: 6, level: 1 }]);
    // Only the new one: Iron Regular was shown before.
    expect(latest.unlocks).toHaveLength(1);
    expect(latest.unlocks[0]).toMatchObject({ pointsBefore: 50, pointsAfter: 75 });
    expect(latest.unlocks[0]!.awards.map((a) => a.definition.title)).toEqual(['First Steps']);

    act(() => latest.dismissUnlock());
    expect(latest.unlocks).toHaveLength(0);
    // Remembered on the server, so it's never shown again.
    expect(markAchievementsSeen).toHaveBeenCalledWith(T1);
  });

  it('shows what the server awarded while you were away -- overnight, a claim, a friend looking', async () => {
    (fetchMyAwards as jest.Mock).mockResolvedValue([
      award('iron-regular', 50, T0),
      award('first-steps', 25, T1),
    ]);
    render(tree());

    await waitFor(() => expect(latest.unlocks).toHaveLength(1));
    expect(latest.unlocks[0]!.awards.map((a) => a.definition.title)).toEqual(['First Steps']);
    // Read again after the award run, it isn't queued twice.
    await waitFor(() => expect(fetchMyAwards).toHaveBeenCalledTimes(2));
    expect(latest.unlocks).toHaveLength(1);
  });

  it('shows everything earned so far, once, the first time', async () => {
    (fetchAchievementsSeenAt as jest.Mock).mockResolvedValue(null);
    (fetchMyAwards as jest.Mock).mockResolvedValue([
      award('iron-regular', 50, T0),
      award('first-steps', 25, T1),
    ]);
    render(tree());

    await waitFor(() => expect(fetchMyAwards).toHaveBeenCalledTimes(2));
    expect(latest.unlocks).toHaveLength(1);
    expect(latest.unlocks[0]).toMatchObject({ pointsBefore: 0, pointsAfter: 75 });
  });

  it('awards again when the app comes back to the front', async () => {
    render(tree());
    await waitFor(() => expect(awardMyAchievements).toHaveBeenCalledTimes(1));

    await act(async () => {
      appStateListeners.forEach((cb) => cb('active'));
    });

    await waitFor(() => expect(awardMyAchievements).toHaveBeenCalledTimes(2));
  });

  it('awards a moment after a workout is finished, or onboarding finishes', async () => {
    jest.useFakeTimers();
    try {
      const view = render(tree());
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(awardMyAchievements).toHaveBeenCalledTimes(1));

      stats.allWorkouts = [{ id: 'w1' }];
      view.rerender(tree());
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      await waitFor(() => expect(awardMyAchievements).toHaveBeenCalledTimes(2));

      // A new account's onboarding -- where a tracked history may just have been claimed.
      profile = { onboardingCompletedAt: '2026-11-15T10:00:00Z' };
      view.rerender(tree());
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      await waitFor(() => expect(awardMyAchievements).toHaveBeenCalledTimes(3));
    } finally {
      stats.allWorkouts = [];
      jest.useRealTimers();
    }
  });

  it('keeps going when awarding fails, and never shows a failure as an unlock', async () => {
    (awardMyAchievements as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    render(tree());

    await waitFor(() => expect(awardMyAchievements).toHaveBeenCalled());
    expect(latest.unlocks).toHaveLength(0);
    expect(latest.points).toBe(50);
  });

  it('forgets everything on sign-out', async () => {
    const view = render(tree());
    await waitFor(() => expect(latest.points).toBe(50));

    (useAuth as jest.Mock).mockReturnValue({ user: null });
    view.rerender(tree());

    await waitFor(() => expect(latest.points).toBe(0));
    expect(latest.definitions).toHaveLength(0);
  });
});
