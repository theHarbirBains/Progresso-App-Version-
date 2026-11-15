import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getPersonProfile, type MembershipTier } from '../lib/api';
import { MembershipContext } from '../membership/useMembership';
import { fetchMyNutritionFigures } from '../social/achievementQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { AchievementsScreen } from './AchievementsScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/api', () => ({ getPersonProfile: jest.fn() }));
jest.mock('../social/achievementQueries', () => ({ fetchMyNutritionFigures: jest.fn() }));
jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({
    theme: { accent: '#D99A50', onAccent: '#000000', accentBg: '#332211' },
    weightUnit: 'kg',
  }),
}));

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: jest.fn(),
  goBack: mockGoBack,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

function me(stats: object = {}) {
  return {
    user: { id: 'me', username: 'harbir', displayName: 'Harbir', avatarUrl: null },
    isSelf: true,
    followerCount: 6,
    stats: {
      workouts: 120,
      lastThirtyDays: 9,
      totalVolumeKg: 19400,
      prCount: 24,
      bestMonthWorkouts: 14,
      totalSets: 1500,
      totalReps: 12000,
      trainingMinutes: 6000,
      oneRepMaxCount: 2,
      exerciseCount: 20,
      bestSessionVolumeKg: 5000,
      bodyweightReps: 0,
      timedSeconds: 0,
      groupWorkouts: 0,
      committedMonths: 1,
      strongWeeks: 12,
      likesReceived: 30,
      likesGiven: 8,
      ...stats,
    },
  };
}

const food = {
  daysLogged: 40,
  foodsLogged: 120,
  proteinG: 6000,
  calories: 60000,
  recipes: 2,
  savedMeals: 0,
};

function renderScreen(membership: MembershipTier = 'everything') {
  return render(
    <MembershipContext.Provider value={membership}>
      <AchievementsScreen navigation={navigation} route={route} />
    </MembershipContext.Provider>,
  );
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'me' }, session: { access_token: 't' } });
  (getPersonProfile as jest.Mock).mockReset().mockResolvedValue(me());
  (fetchMyNutritionFigures as jest.Mock).mockReset().mockResolvedValue(food);
  mockGoBack.mockClear();
});

describe('AchievementsScreen', () => {
  it('counts the ranks earned and how many achievements reached each rank', async () => {
    renderScreen();

    expect(screen.getByTestId('achievements-loading')).toBeTruthy();
    expect(await screen.findByTestId('achievements-summary')).toHaveTextContent(
      /of 216 ranks earned/,
    );
    expect(screen.getByTestId('achievements-ladder-bronze').props.accessibilityLabel).toMatch(
      /^Bronze: \d+ achievements$/,
    );
    expect(screen.getByTestId('achievements-ladder-legacy').props.accessibilityLabel).toBe(
      'Legacy: 0 achievements',
    );
    expect(getPersonProfile).toHaveBeenCalledWith('t', 'me');
    expectNoBareText();
  });

  it('lists every achievement by kind, with its rank and how far to the next', async () => {
    renderScreen();

    expect(await screen.findByTestId('achievement-workouts')).toHaveTextContent(
      /Iron Regular.*Gold.*Finish workouts/,
    );
    expect(screen.getByTestId('achievement-workouts-progress')).toHaveTextContent(
      '120 workouts · Platinum at 200 workouts',
    );
    expect(screen.getByTestId('achievement-timed')).toHaveTextContent(/Iron Core.*No rank yet/);
    for (const kind of ['training', 'consistency', 'strength', 'social', 'nutrition']) {
      expect(screen.getByTestId(`achievements-${kind}`)).toBeTruthy();
    }
  });

  it('shows nutrition achievements, which only you see', async () => {
    renderScreen();

    expect(await screen.findByTestId('achievements-nutrition')).toHaveTextContent(
      /Nutrition.*Only you see these/,
    );
    expect(screen.getByTestId('achievement-food-days')).toHaveTextContent(/Fuel Logger.*Gold/);
    expect(screen.getByTestId('achievement-meals')).toHaveTextContent(/Meal Prepper.*No rank yet/);
  });

  it('has no nutrition achievements when Nutrition is not in your membership', async () => {
    renderScreen('workouts');

    await screen.findByTestId('achievements-summary');
    expect(screen.getByTestId('achievements-summary')).toHaveTextContent(/of 162 ranks earned/);
    expect(screen.queryByTestId('achievements-nutrition')).toBeNull();
    expect(fetchMyNutritionFigures).not.toHaveBeenCalled();
  });

  it('says so when your nutrition could not be read, showing the rest', async () => {
    (fetchMyNutritionFigures as jest.Mock).mockRejectedValue(new Error('offline'));
    renderScreen();

    expect(await screen.findByTestId('achievements-nutrition-error')).toBeTruthy();
    expect(screen.getByTestId('achievement-workouts')).toBeTruthy();
  });

  it("opens an achievement's nine ranks", async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('achievement-prs'));

    expect(screen.getByTestId('achievements-sheet')).toHaveTextContent(/Record Breaker.*Silver/);
    expect(screen.getByTestId('achievements-sheet-rank-gold').props.accessibilityLabel).toBe(
      'Gold: 25 PRs. Next',
    );
  });

  it('says so when it cannot be read, and goes back', async () => {
    (getPersonProfile as jest.Mock).mockRejectedValue(new Error('Network down'));
    renderScreen();

    expect(await screen.findByTestId('achievements-error')).toHaveTextContent('Network down');
  });
});
