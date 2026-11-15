import { fireEvent, render, screen } from '@testing-library/react-native';
import type { MembershipTier } from '../lib/api';
import { MembershipContext } from '../membership/useMembership';
import type { AchievementDefinition } from '../achievements/achievementQueries';
import { AchievementsContext, type AchievementsValue } from '../achievements/achievementsContext';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { AchievementsScreen } from './AchievementsScreen';

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({
    theme: { accent: '#D99A50', onAccent: '#000000', accentBg: '#332211' },
    weightUnit: 'lb',
  }),
}));

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

function def(extra: Partial<AchievementDefinition>): AchievementDefinition {
  return {
    id: 'dedicated',
    category: 'workouts',
    title: 'Dedicated',
    description: 'Finish 25 workouts',
    icon: 'activity',
    ap: 125,
    repeats: 'once',
    metric: 'workouts',
    threshold: 25,
    unit: 'count',
    visibility: 'public',
    sort: 40,
    ...extra,
  };
}

const definitions = [
  def({
    id: 'first-steps',
    title: 'First Steps',
    description: 'Finish your first workout',
    ap: 25,
    threshold: 1,
    sort: 10,
  }),
  def({}),
  def({
    id: 'heavy-lifter',
    category: 'volume',
    title: 'Heavy Lifter',
    description: 'Lift 10,000 lb in all',
    metric: 'volume_kg',
    threshold: 4535.9237,
    unit: 'kg',
    ap: 100,
    sort: 620,
  }),
  def({
    id: 'weekly-warrior',
    category: 'consistency',
    title: 'Weekly Warrior',
    description: 'Meet your weekly workout goal -- every week you do',
    repeats: 'weekly',
    metric: 'week_goal',
    threshold: 1,
    ap: 25,
    sort: 120,
  }),
  def({
    id: 'first-bite',
    category: 'nutrition',
    title: 'First Bite',
    description: 'Log your first food',
    metric: 'food_entries',
    threshold: 1,
    ap: 25,
    visibility: 'private',
    sort: 310,
  }),
];

const evaluate = jest.fn(async () => undefined);

function renderScreen(
  membership: MembershipTier = 'everything',
  extra: Partial<AchievementsValue> = {},
) {
  const value: AchievementsValue = {
    definitions,
    awards: [
      {
        achievementId: 'first-steps',
        periodKey: 'once',
        ap: 25,
        awardedAt: '2026-11-01T10:00:00Z',
      },
      {
        achievementId: 'weekly-warrior',
        periodKey: 'W:2026-11-02',
        ap: 25,
        awardedAt: '2026-11-04T10:00:00Z',
      },
      {
        achievementId: 'weekly-warrior',
        periodKey: 'W:2026-11-09',
        ap: 25,
        awardedAt: '2026-11-11T10:00:00Z',
      },
    ],
    metrics: { workouts: 12, volume_kg: 2000, week_workouts: 1, goal: 3, food_entries: 0 },
    points: 2_250,
    loading: false,
    error: null,
    evaluate,
    unlocks: [],
    dismissUnlock: jest.fn(),
    ...extra,
  };
  return render(
    <MembershipContext.Provider value={membership}>
      <AchievementsContext.Provider value={value}>
        <AchievementsScreen navigation={navigation} route={route} />
      </AchievementsContext.Provider>
    </MembershipContext.Provider>,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  evaluate.mockClear();
});

describe('AchievementsScreen', () => {
  it('shows your lifetime rank, AP and the way to the next division, every rank a tap away', () => {
    renderScreen();

    expect(screen.getByTestId('achievements-rank')).toHaveTextContent(
      /Gold III.*2,250 AP.*150 AP to Gold II/,
    );
    expect(screen.getByTestId('achievements-count')).toHaveTextContent(
      '2 of 5 achievements earned',
    );
    fireEvent.press(screen.getByTestId('achievements-rank'));
    expect(mockNavigate).toHaveBeenCalledWith('RankProgression');
    // Opening it asks the server for anything new.
    expect(evaluate).toHaveBeenCalled();
    expectNoBareText();
  });

  it('lists what you earned, when -- and what is still ahead, with exactly where you are', () => {
    renderScreen();

    expect(screen.getByTestId('achievement-first-steps')).toHaveTextContent(
      /First Steps.*25 AP.*Earned/,
    );
    expect(screen.getByTestId('achievement-dedicated')).toHaveTextContent(
      /Dedicated.*125 AP.*Finish 25 workouts.*12 \/ 25/,
    );
    expect(screen.getByTestId('achievement-heavy-lifter')).toHaveTextContent(
      /Lift 10,000 lb in all.*4,409 \/ 10,000 lb/,
    );
    expect(screen.getByTestId('achievement-weekly-warrior')).toHaveTextContent(
      /25 AP each.*Earned 2 times.*1 \/ 3 this week/,
    );
    expect(screen.getByTestId('achievements-earned')).toHaveTextContent(/Earned \(2\)/);
    expect(screen.getByTestId('achievements-ahead')).toHaveTextContent(/Still Ahead \(3\)/);
  });

  it('filters by kind, and by repeatable', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('achievements-filter-volume'));
    expect(screen.getByTestId('achievement-heavy-lifter')).toBeTruthy();
    expect(screen.queryByTestId('achievement-first-steps')).toBeNull();

    fireEvent.press(screen.getByTestId('achievements-filter-repeatable'));
    expect(screen.getByTestId('achievement-weekly-warrior')).toBeTruthy();
    expect(screen.queryByTestId('achievement-heavy-lifter')).toBeNull();
  });

  it('shows nutrition ones, only you see, with Nutrition in your membership', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('achievements-filter-nutrition'));
    expect(screen.getByTestId('achievement-first-bite')).toBeTruthy();
    expect(screen.getByTestId('achievements-ahead')).toHaveTextContent(/Only you see these/);
  });

  it('has no nutrition ones without Nutrition', () => {
    renderScreen('workouts');

    expect(screen.queryByTestId('achievement-first-bite')).toBeNull();
    expect(screen.queryByTestId('achievements-filter-nutrition')).toBeNull();
    expect(screen.getByTestId('achievements-count')).toHaveTextContent(
      '2 of 4 achievements earned',
    );
  });

  it('shows placeholders while it loads, and says so when it cannot', () => {
    const loading = renderScreen('everything', { loading: true, definitions: [] });
    expect(screen.getByTestId('achievements-loading')).toBeTruthy();
    loading.unmount();

    renderScreen('everything', { error: 'Network down', definitions: [] });
    expect(screen.getByTestId('achievements-error')).toHaveTextContent('Network down');
  });
});
