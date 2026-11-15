import { fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import type { AchievementDefinition } from './achievementQueries';
import {
  AchievementsContext,
  type AchievementsValue,
  type UnlockBatch,
} from './achievementsContext';
import { AchievementUnlockHost } from './AchievementUnlockHost';

function definition(id: string, title: string, ap: number): AchievementDefinition {
  return {
    id,
    category: 'workouts',
    title,
    description: `${title}, done`,
    icon: 'activity',
    ap,
    repeats: 'once',
    metric: 'workouts',
    threshold: 1,
    unit: 'count',
    visibility: 'public',
    sort: 1,
  };
}

function batch(items: [string, string, number][], pointsBefore: number): UnlockBatch {
  const awards = items.map(([id, title, ap]) => ({
    award: { achievementId: id, periodKey: 'once', ap, awardedAt: '2026-11-14T10:00:00Z' },
    definition: definition(id, title, ap),
  }));
  return {
    id: 'b1',
    awards,
    pointsBefore,
    pointsAfter: pointsBefore + awards.reduce((sum, a) => sum + a.award.ap, 0),
  };
}

const dismissUnlock = jest.fn();
const onOpen = jest.fn();

function renderHost(unlocks: UnlockBatch[], route = 'Feed') {
  const value: AchievementsValue = {
    definitions: [],
    awards: [],
    metrics: {},
    points: 0,
    loading: false,
    error: null,
    evaluate: async () => undefined,
    unlocks,
    dismissUnlock,
  };
  return render(
    <AchievementsContext.Provider value={value}>
      <AchievementUnlockHost currentRouteName={route} onOpenAchievements={onOpen} />
    </AchievementsContext.Provider>,
  );
}

beforeEach(() => {
  dismissUnlock.mockClear();
  onOpen.mockClear();
});

describe('AchievementUnlockHost', () => {
  it('shows an achievement, the AP it gave and the rank it leaves you at', () => {
    renderHost([batch([['dedicated', 'Dedicated', 125]], 300)]);

    expect(screen.getByTestId('achievement-unlock-awards')).toHaveTextContent(
      /Achievement Unlocked.*Dedicated.*Dedicated, done/,
    );
    expect(screen.getByTestId('achievement-unlock-ap')).toHaveTextContent('+125 AP');
    // 425 AP: Bronze I, with 75 to go to Silver V.
    expect(screen.getByTestId('achievement-unlock-awards')).toHaveTextContent(
      /Bronze I.*New division.*75 AP to Silver V/,
    );
    expectNoBareText();

    fireEvent.press(screen.getByTestId('achievement-unlock-continue'));
    expect(dismissUnlock).toHaveBeenCalled();
  });

  it('never interrupts a live workout', () => {
    for (const route of ['ActiveWorkout', 'GroupSession', 'TrainerLiveWorkout']) {
      const view = renderHost([batch([['dedicated', 'Dedicated', 125]], 300)], route);
      expect(screen.queryByTestId('achievement-unlock')).toBeNull();
      view.unmount();
    }
  });

  it('shows a new rank on its own first, then the achievements', () => {
    renderHost([batch([['veteran', 'Veteran', 1000]], 1000)]);

    expect(screen.getByTestId('achievement-unlock-rank')).toHaveTextContent(
      /New Rank.*Gold.*Gold IV · 2,000 AP/,
    );
    expect(screen.queryByTestId('achievement-unlock-awards')).toBeNull();

    fireEvent.press(screen.getByTestId('achievement-unlock-continue'));
    expect(screen.getByTestId('achievement-unlock-awards')).toHaveTextContent(/Veteran/);
    expect(dismissUnlock).not.toHaveBeenCalled();
  });

  it('lists several at once with their total, and a summary past four', () => {
    renderHost([
      batch(
        [
          ['a', 'First Steps', 25],
          ['b', 'First PR', 50],
          ['c', 'First 1,000', 50],
          ['d', 'Split Creator', 50],
          ['e', 'First Week', 50],
        ],
        0,
      ),
    ]);

    expect(screen.getByTestId('achievement-unlock-awards')).toHaveTextContent(
      /5 Achievements Unlocked.*First Steps.*\+25.*Split Creator.*and 1 more/,
    );
    expect(screen.getByTestId('achievement-unlock-ap')).toHaveTextContent('+225 AP');
  });

  it('opens your achievements', () => {
    renderHost([batch([['dedicated', 'Dedicated', 125]], 300)]);

    fireEvent.press(screen.getByTestId('achievement-unlock-open'));

    expect(dismissUnlock).toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalled();
  });

  it('shows nothing with nothing new', () => {
    renderHost([]);
    expect(screen.queryByTestId('achievement-unlock')).toBeNull();
  });
});
