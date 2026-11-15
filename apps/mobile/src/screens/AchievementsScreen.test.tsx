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

const LB = 0.45359237;
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
    id: 'iron-regular',
    category: 'workouts',
    kind: 'levels',
    title: 'Iron Regular',
    description: 'Finish workouts',
    icon: 'activity',
    metric: 'workouts',
    unit: 'count',
    goalLabel: 'workouts',
    visibility: 'public',
    sort: 90,
    levels: [
      { level: 1, goal: 5, ap: 50 },
      { level: 2, goal: 10, ap: 75 },
      { level: 3, goal: 25, ap: 125 },
    ],
    ...extra,
  };
}

const definitions = [
  def({
    id: 'first-steps',
    kind: 'single',
    title: 'First Steps',
    description: 'Finish your first workout',
    sort: 10,
    levels: [{ level: 1, goal: 1, ap: 25 }],
  }),
  def({}),
  def({
    id: 'guns-blazin',
    category: 'muscles',
    title: "Guns Blazin'",
    description: 'Lift weight on biceps exercises',
    metric: 'muscle_volume_kg_biceps',
    unit: 'kg',
    goalLabel: 'lifted on biceps',
    sort: 300,
    levels: [
      { level: 1, goal: 1_000 * LB, ap: 20 },
      { level: 2, goal: 10_000 * LB, ap: 40 },
    ],
  }),
  def({
    id: 'first-bite',
    category: 'nutrition',
    kind: 'single',
    title: 'First Bite',
    description: 'Log your first food',
    metric: 'food_entries',
    goalLabel: 'foods logged',
    visibility: 'private',
    sort: 60,
    levels: [{ level: 1, goal: 1, ap: 25 }],
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
      { achievementId: 'first-steps', level: 1, ap: 25, awardedAt: '2026-11-01T10:00:00Z' },
      { achievementId: 'iron-regular', level: 1, ap: 50, awardedAt: '2026-11-04T10:00:00Z' },
      { achievementId: 'iron-regular', level: 2, ap: 75, awardedAt: '2026-11-11T10:00:00Z' },
    ],
    progress: [
      { achievementId: 'first-steps', value: 12, level: 1 },
      { achievementId: 'iron-regular', value: 12, level: 2 },
      { achievementId: 'guns-blazin', value: 300, level: 0 },
      { achievementId: 'first-bite', value: 0, level: 0 },
    ],
    points: 2_150,
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
      /Gold V.*2,150 AP.*250 AP to Gold IV/,
    );
    // 1 + 2 of 1 + 3 + 2 + 1 levels.
    expect(screen.getByTestId('achievements-count')).toHaveTextContent(
      '3 of 7 levels reached across 4 achievements',
    );
    fireEvent.press(screen.getByTestId('achievements-rank'));
    expect(mockNavigate).toHaveBeenCalledWith('RankProgression');
    // Opening it asks the server for anything new.
    expect(evaluate).toHaveBeenCalled();
    expectNoBareText();
  });

  it('shows each one at its level, the way to its next level, what that takes and its AP', () => {
    renderScreen();

    expect(screen.getByTestId('achievement-iron-regular')).toHaveTextContent(
      /Iron Regular.*Level 2 of 3.*Finish workouts.*12 \/ 25.*Level 3: 25 workouts · \+125 AP.*125 AP earned/,
    );
    expect(screen.getByTestId('achievement-first-steps')).toHaveTextContent(
      /First Steps.*Unlocked/,
    );
    expect(screen.getByTestId('achievement-guns-blazin')).toHaveTextContent(
      /Guns Blazin'.*Not started.*661 \/ 1,000 lb.*Level 1: 1,000 lb lifted on biceps · \+20 AP/,
    );
    expect(screen.getByTestId('achievements-earned')).toHaveTextContent(/Earned \(2\)/);
    expect(screen.getByTestId('achievements-ahead')).toHaveTextContent(/Not Started \(2\)/);
  });

  it('lists every level and the AP each pays when one is tapped', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('achievement-iron-regular'));

    const sheet = screen.getByTestId('achievement-levels');
    expect(sheet).toHaveTextContent(/Iron Regular.*Level 2 of 3.*Finish workouts/);
    expect(screen.getByTestId('achievement-levels-total')).toHaveTextContent(
      '125 of 250 AP earned',
    );
    expect(screen.getByTestId('achievement-levels-level-1').props.accessibilityLabel).toBe(
      'Level 1: 5 workouts, 50 AP. Reached',
    );
    expect(screen.getByTestId('achievement-levels-level-2').props.accessibilityLabel).toBe(
      'Level 2: 10 workouts, 75 AP. Reached',
    );
    expect(screen.getByTestId('achievement-levels-level-3').props.accessibilityLabel).toBe(
      'Level 3: 25 workouts, 125 AP. Next -- 12 / 25 so far',
    );
    expect(screen.getByTestId('achievement-levels-level-3')).toHaveTextContent(
      /Level 3.*25 workouts.*12 \/ 25.*\+125 AP/,
    );
  });

  it("shows a weight achievement's levels in your unit", () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('achievement-guns-blazin'));

    expect(screen.getByTestId('achievement-levels-level-1')).toHaveTextContent(
      /Level 1.*1,000 lb lifted on biceps.*661 \/ 1,000 lb.*\+20 AP/,
    );
    expect(screen.getByTestId('achievement-levels-level-2').props.accessibilityLabel).toBe(
      'Level 2: 10,000 lb lifted on biceps, 40 AP. Not reached yet',
    );
    expect(screen.getByTestId('achievement-levels-total')).toHaveTextContent('0 of 60 AP earned');
  });

  it('shows a single unlock as one unlock', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('achievement-first-steps'));

    expect(screen.getByTestId('achievement-levels-level-1').props.accessibilityLabel).toBe(
      'Unlock: Finish your first workout, 25 AP. Reached',
    );
  });

  it('says when every level is reached', () => {
    renderScreen('everything', {
      awards: [1, 2, 3].map((level) => ({
        achievementId: 'iron-regular',
        level,
        ap: [50, 75, 125][level - 1]!,
        awardedAt: `2026-11-0${level}T10:00:00Z`,
      })),
      progress: [{ achievementId: 'iron-regular', value: 40, level: 3 }],
    });

    expect(screen.getByTestId('achievement-iron-regular')).toHaveTextContent(
      /Level 3 of 3.*Every level reached.*250 AP earned/,
    );
  });

  it('filters by kind', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('achievements-filter-muscles'));
    expect(screen.getByTestId('achievement-guns-blazin')).toBeTruthy();
    expect(screen.queryByTestId('achievement-first-steps')).toBeNull();
    // No repeatable achievements any more.
    expect(screen.queryByTestId('achievements-filter-repeatable')).toBeNull();
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
    expect(screen.getByTestId('achievements-count')).toHaveTextContent(/across 3 achievements/);
  });

  it('shows placeholders while it loads, and says so when it cannot', () => {
    const loading = renderScreen('everything', { loading: true, definitions: [] });
    expect(screen.getByTestId('achievements-loading')).toBeTruthy();
    loading.unmount();

    renderScreen('everything', { error: 'Network down', definitions: [] });
    expect(screen.getByTestId('achievements-error')).toHaveTextContent('Network down');
  });
});
