import { fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import type { AchievementDefinition } from './achievementQueries';
import {
  AchievementsContext,
  type AchievementsValue,
  type UnlockBatch,
} from './achievementsContext';
import { AchievementUnlockHost } from './AchievementUnlockHost';

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({
    theme: { accent: '#D99A50', onAccent: '#000000', accentBg: '#332211' },
    weightUnit: 'lb',
  }),
}));

/** A single unlock, or (with `levels`) a ladder of that many, 10 workouts a level apart. */
function definition(id: string, title: string, ap: number, levels = 1): AchievementDefinition {
  return {
    id,
    category: 'workouts',
    kind: levels > 1 ? 'levels' : 'single',
    title,
    description: `${title}, done`,
    icon: 'activity',
    metric: 'workouts',
    unit: 'count',
    goalLabel: 'workouts',
    visibility: 'public',
    sort: 1,
    levels: Array.from({ length: levels }, (_, i) => ({
      level: i + 1,
      goal: (i + 1) * 10,
      ap: ap * (i + 1),
    })),
  };
}

/** Levels awarded together: [id, title, ap, level, levels]. */
function batch(
  items: [string, string, number, number?, number?][],
  pointsBefore: number,
): UnlockBatch {
  const awards = items.map(([id, title, ap, level = 1, levels = 1]) => ({
    award: { achievementId: id, level, ap, awardedAt: '2026-11-14T10:00:00Z' },
    definition: definition(id, title, ap / level, levels),
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

function renderHost(
  unlocks: UnlockBatch[],
  route = 'Feed',
  progress: AchievementsValue['progress'] = [],
) {
  const value: AchievementsValue = {
    definitions: [],
    awards: unlocks.flatMap((b) => b.awards.map((a) => a.award)),
    progress,
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
  it('shows a level up: the level it was at and has reached, its AP and how far to the next', () => {
    renderHost([batch([['iron-regular', 'Iron Regular', 75, 3, 5]], 300)], 'Feed', [
      { achievementId: 'iron-regular', value: 34, level: 3 },
    ]);

    expect(screen.getByTestId('achievement-unlock-awards')).toHaveTextContent(
      /Level Up.*Iron Regular/,
    );
    // Level 2 to 3: 75 AP; next, level 4 at 40 workouts for 100.
    expect(screen.getByTestId('achievement-unlock-step')).toHaveTextContent('Level 2 → Level 3');
    expect(screen.getByTestId('achievement-unlock-ap')).toHaveTextContent('+75 AP');
    expect(screen.getByTestId('achievement-unlock-next')).toHaveTextContent(
      'Level 4 at 40 workouts · +100 AP',
    );
  });

  it('shows an achievement, the AP it gave and the rank it leaves you at', () => {
    renderHost([batch([['dedicated', 'Dedicated', 125]], 200)]);

    expect(screen.getByTestId('achievement-unlock-awards')).toHaveTextContent(
      /Achievement Unlocked.*Dedicated.*Unlocked.*Dedicated, done/,
    );
    expect(screen.getByTestId('achievement-unlock-ap')).toHaveTextContent('+125 AP');
    // 200 to 325 AP: Bronze IV to Bronze III, with 125 to go to Bronze II.
    expect(screen.getByTestId('achievement-unlock-awards')).toHaveTextContent(
      /Bronze III.*New division.*125 AP to Bronze II/,
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
      /New Rank.*Gold.*Gold V · 2,000 AP/,
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
      /5 Achievements Unlocked.*First Steps.*Unlocked.*\+25.*Split Creator.*and 1 more/,
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
