import { act, render, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import {
  awardMyAchievements,
  fetchAchievementDefinitions,
  fetchMyAwards,
  fetchMyProgress,
} from './achievementQueries';
import { useAchievements, type AchievementsValue } from './achievementsContext';
import { AchievementsProvider } from './AchievementsProvider';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../nutrition/FoodLogProvider', () => ({ useFoodLog: jest.fn() }));
jest.mock('../progress/AllTimeStatsProvider', () => ({ useAllTimeStats: jest.fn() }));
jest.mock('./achievementQueries', () => ({
  fetchAchievementDefinitions: jest.fn(),
  fetchMyAwards: jest.fn(),
  fetchMyProgress: jest.fn(),
  awardMyAchievements: jest.fn(),
}));

const firstSteps = {
  id: 'first-steps',
  category: 'workouts',
  kind: 'single',
  title: 'First Steps',
  description: 'Finish your first workout',
  icon: 'play',
  metric: 'workouts',
  unit: 'count',
  goalLabel: 'workouts',
  visibility: 'public',
  sort: 10,
  levels: [{ level: 1, goal: 1, ap: 25 }],
};
const award = (id: string, ap: number, level = 1) => ({
  achievementId: id,
  level,
  ap,
  awardedAt: '2026-11-14T10:00:00Z',
});

let latest: AchievementsValue;
function Probe() {
  latest = useAchievements();
  return null;
}

const stats = { allWorkouts: [] as unknown[], repPRs: [] as unknown[] };
// Whoever listens for the app coming back to the front.
let appStateListeners: ((state: string) => void)[] = [];
const food = { logs: [] as unknown[] };

beforeEach(() => {
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
    appStateListeners.push(cb as (state: string) => void);
    return { remove: jest.fn() } as never;
  });
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'me' } });
  (useAllTimeStats as jest.Mock).mockImplementation(() => stats);
  (useFoodLog as jest.Mock).mockImplementation(() => food);
  (fetchAchievementDefinitions as jest.Mock).mockReset().mockResolvedValue([firstSteps]);
  (fetchMyAwards as jest.Mock).mockReset().mockResolvedValue([award('iron-regular', 50)]);
  (fetchMyProgress as jest.Mock)
    .mockReset()
    .mockResolvedValue([{ achievementId: 'first-steps', value: 1, level: 1 }]);
  (awardMyAchievements as jest.Mock).mockReset().mockResolvedValue([]);
});

describe('AchievementsProvider', () => {
  it('reads the catalogue, your awards and progress as you sign in, then awards what you reached', async () => {
    (awardMyAchievements as jest.Mock).mockResolvedValueOnce([award('first-steps', 25)]);
    render(
      <AchievementsProvider>
        <Probe />
      </AchievementsProvider>,
    );

    await waitFor(() => expect(latest.points).toBe(75));
    expect(fetchMyAwards).toHaveBeenCalledWith('me');
    // Progress is read again after the award run.
    expect(fetchMyProgress).toHaveBeenCalledTimes(2);
    expect(latest.progress).toEqual([{ achievementId: 'first-steps', value: 1, level: 1 }]);
    expect(latest.definitions).toHaveLength(1);
    // What came in is queued to be shown, with the AP before and after.
    expect(latest.unlocks).toHaveLength(1);
    expect(latest.unlocks[0]).toMatchObject({ pointsBefore: 50, pointsAfter: 75 });
    expect(latest.unlocks[0]!.awards[0]!.definition.title).toBe('First Steps');

    act(() => latest.dismissUnlock());
    expect(latest.unlocks).toHaveLength(0);
  });

  it('awards again when the app comes back to the front', async () => {
    render(
      <AchievementsProvider>
        <Probe />
      </AchievementsProvider>,
    );
    await waitFor(() => expect(awardMyAchievements).toHaveBeenCalledTimes(1));

    await act(async () => {
      appStateListeners.forEach((cb) => cb('active'));
    });

    await waitFor(() => expect(awardMyAchievements).toHaveBeenCalledTimes(2));
  });

  it('awards a moment after a workout is finished', async () => {
    jest.useFakeTimers();
    try {
      const view = render(
        <AchievementsProvider>
          <Probe />
        </AchievementsProvider>,
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(awardMyAchievements).toHaveBeenCalledTimes(1));

      stats.allWorkouts = [{ id: 'w1' }];
      view.rerender(
        <AchievementsProvider>
          <Probe />
        </AchievementsProvider>,
      );
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });

      await waitFor(() => expect(awardMyAchievements).toHaveBeenCalledTimes(2));
    } finally {
      stats.allWorkouts = [];
      jest.useRealTimers();
    }
  });

  it('keeps going when awarding fails, and never shows a failure as an unlock', async () => {
    (awardMyAchievements as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    render(
      <AchievementsProvider>
        <Probe />
      </AchievementsProvider>,
    );

    await waitFor(() => expect(awardMyAchievements).toHaveBeenCalled());
    expect(latest.unlocks).toHaveLength(0);
    expect(latest.points).toBe(50);
  });

  it('forgets everything on sign-out, and reads nothing signed out', async () => {
    const view = render(
      <AchievementsProvider>
        <Probe />
      </AchievementsProvider>,
    );
    await waitFor(() => expect(latest.points).toBe(50));

    (useAuth as jest.Mock).mockReturnValue({ user: null });
    view.rerender(
      <AchievementsProvider>
        <Probe />
      </AchievementsProvider>,
    );

    await waitFor(() => expect(latest.points).toBe(0));
    expect(latest.definitions).toHaveLength(0);
  });
});
