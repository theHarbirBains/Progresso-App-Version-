import type { PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchIntakeForRange } from '../nutrition/foodLogQueries';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { NutritionGoalsProvider } from '../nutrition/NutritionGoalsProvider';
import { dayKey } from '../lib/dayKey';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ConsistencyBlock } from './ConsistencyBlock';
import { NutritionProgressSection, averageDay, nutritionDays } from './NutritionProgressSection';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../nutrition/foodLogQueries', () => ({ fetchIntakeForRange: jest.fn() }));
jest.mock('../nutrition/nutritionGoalQueries', () => ({ fetchNutritionGoals: jest.fn() }));

function Providers({ children }: PropsWithChildren) {
  return <NutritionGoalsProvider>{children}</NutritionGoalsProvider>;
}

/** An ISO instant `daysAgo` days before today, at noon local time. */
function ago(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1' } });
  (fetchNutritionGoals as jest.Mock).mockResolvedValue({
    calories: 2000,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  (fetchIntakeForRange as jest.Mock).mockReset().mockResolvedValue([]);
});

/** A food log's figures, `daysAgo` days before today. */
function log(daysAgo: number, calories: number, proteinG: number, carbsG = 0, fatG = 0) {
  return { loggedAt: ago(daysAgo), calories, proteinG, carbsG, fatG };
}

function renderSection(onOpenDay = jest.fn(), onOpenHistory = jest.fn()) {
  render(
    <NutritionProgressSection
      accentColor="#E8A33D"
      onAccentColor="#000"
      onOpenDay={onOpenDay}
      onOpenHistory={onOpenHistory}
    />,
    { wrapper: Providers },
  );
  return { onOpenDay, onOpenHistory };
}

describe('nutritionDays', () => {
  it('adds each day up, newest first, with the target in force that day', () => {
    const days = nutritionDays(
      [log(1, 800, 50, 90, 20), log(1, 1100, 70, 120, 30), log(0, 2500, 150, 250, 80)],
      (key) => (key === dayKey(new Date()) ? 1800 : 2000),
    );

    expect(
      days.map((day) => [day.calories, day.proteinG, day.carbsG, day.fatG, day.calorieTarget]),
    ).toEqual([
      [2500, 150, 250, 80, 1800],
      [1900, 120, 210, 50, 2000],
    ]);
  });
});

describe('averageDay', () => {
  it('averages every figure over the days logged, and is nothing with none', () => {
    const days = nutritionDays(
      [log(0, 2000, 150, 200, 60), log(3, 2500, 100, 301, 81)],
      () => null,
    );

    expect(averageDay(days)).toEqual({ calories: 2250, proteinG: 125, carbsG: 250.5, fatG: 70.5 });
    expect(averageDay([])).toBeNull();
  });
});

describe('NutritionProgressSection', () => {
  it('opens on all time: the average day, as the Nutrition screen draws one, and the days logged', async () => {
    (fetchNutritionGoals as jest.Mock).mockResolvedValue({
      calories: 2000,
      proteinG: 150,
      carbsG: 250,
      fatG: 70,
    });
    (fetchIntakeForRange as jest.Mock).mockResolvedValue([
      log(0, 1950, 140, 240, 65),
      log(40, 2500, 100, 261, 76),
    ]);
    const { onOpenHistory } = renderSection();

    expect(await screen.findByTestId('progress-nutrition-logged')).toHaveTextContent(
      /^2Days Logged$/,
    );
    expect(
      screen.getByTestId('progress-nutrition-range-all').props.accessibilityState.selected,
    ).toBe(true);
    // Read from the very first log, up to the end of today.
    const [, start] = (fetchIntakeForRange as jest.Mock).mock.calls[0]!;
    expect((start as Date).getTime()).toBe(0);
    // 2,225 cal, 120 g protein, 250.5 g carbs and 70.5 g fat a day -- each rounded down.
    await waitFor(() =>
      expect(
        screen.getByTestId('progress-nutrition-ring-value', { includeHiddenElements: true }),
      ).toHaveTextContent('2225'),
    );
    expect(screen.getByTestId('progress-nutrition-ring').props.accessibilityLabel).toBe(
      '2225 of 2000 calories a day on average',
    );
    expect(screen.getByTestId('progress-nutrition-protein-consumed')).toHaveTextContent('120g');
    expect(screen.getByTestId('progress-nutrition-protein-goal')).toHaveTextContent('/ 150g');
    expect(screen.getByTestId('progress-nutrition-carbs-consumed')).toHaveTextContent('250g');
    expect(screen.getByTestId('progress-nutrition-fat-consumed')).toHaveTextContent('70g');
    expect(screen.getByTestId('progress-nutrition-fat-row').props.accessibilityLabel).toBe(
      'Fat, 70 of 70 grams a day on average',
    );
    expect(screen.getByTestId('progress-nutrition-on-target')).toHaveTextContent(/1 of 2/);
    expect(screen.getByTestId('progress-nutrition-note')).toHaveTextContent(/^Since /);
    // Every day there is is Nutrition History's to list.
    expect(screen.queryByTestId(/^progress-nutrition-day-/)).toBeNull();
    fireEvent.press(screen.getByTestId('progress-nutrition-history'));
    expect(onOpenHistory).toHaveBeenCalled();
    expectNoBareText();
  });

  it('sums up the week the same way, and lists its days, each opening its foods', async () => {
    (fetchIntakeForRange as jest.Mock).mockResolvedValue([log(0, 1950, 140), log(2, 2500, 100)]);
    const { onOpenDay } = renderSection();
    await screen.findByTestId('progress-nutrition-logged');

    fireEvent.press(screen.getByTestId('progress-nutrition-range-week'));

    expect(await screen.findByTestId('progress-nutrition-logged')).toHaveTextContent(/2 of 7/);
    const [, start, end] = (fetchIntakeForRange as jest.Mock).mock.calls[1]!;
    expect(Math.round(((end as Date).getTime() - (start as Date).getTime()) / 86400000)).toBe(7);
    const twoDaysAgo = dayKey(new Date(ago(2)));
    expect(screen.getByTestId(`progress-nutrition-day-${twoDaysAgo}`)).toHaveTextContent(
      /500 over/,
    );
    fireEvent.press(screen.getByTestId(`progress-nutrition-day-${twoDaysAgo}`));
    expect(onOpenDay).toHaveBeenCalledWith(twoDaysAgo);
    expect(screen.queryByTestId('progress-nutrition-history')).toBeNull();
    expectNoBareText();
  });

  it('reads three months when chosen, and says when nothing was logged', async () => {
    renderSection();

    expect(await screen.findByTestId('progress-nutrition-empty')).toHaveTextContent(
      'No food logged yet.',
    );
    fireEvent.press(screen.getByTestId('progress-nutrition-range-quarter'));

    await waitFor(() => expect(fetchIntakeForRange).toHaveBeenCalledTimes(2));
    const [, start, end] = (fetchIntakeForRange as jest.Mock).mock.calls[1]!;
    expect(Math.round(((end as Date).getTime() - (start as Date).getTime()) / 86400000)).toBe(90);
    expect(await screen.findByTestId('progress-nutrition-empty')).toHaveTextContent(
      'No food logged in this time.',
    );
  });

  it('shows the macros with no bar or target when there is none', async () => {
    (fetchIntakeForRange as jest.Mock).mockResolvedValue([log(0, 1950, 140, 240, 65)]);
    renderSection();

    expect(await screen.findByTestId('progress-nutrition-protein-consumed')).toHaveTextContent(
      '140g',
    );
    expect(screen.queryByTestId('progress-nutrition-protein-goal')).toBeNull();
    expect(screen.queryByTestId('progress-nutrition-protein-bar')).toBeNull();
  });
});

describe('ConsistencyBlock', () => {
  it('counts the weeks that reached the weekly goal over the last 12', () => {
    render(
      <ConsistencyBlock
        workouts={[{ performedAt: ago(0) }, { performedAt: ago(0) }, { performedAt: ago(21) }]}
        weeklyGoal={2}
        accentColor="#E8A33D"
        onOpenHistory={jest.fn()}
      />,
    );

    expect(screen.getByTestId('progress-consistency-goal')).toHaveTextContent(
      '1 of the last 12 weeks reached your goal of 2 a week',
    );
    // This week's two, and three over twelve weeks; no line graph.
    expect(screen.getByTestId('progress-consistency-this-week')).toHaveTextContent(/^2/);
    expect(screen.getByTestId('progress-consistency-average')).toHaveTextContent(/^0.3/);
    expect(screen.queryByTestId('progress-consistency-chart')).toBeNull();
  });

  it('just shows workouts a week without a goal, and links to the workouts', () => {
    const onOpenHistory = jest.fn();
    render(
      <ConsistencyBlock
        workouts={[]}
        weeklyGoal={null}
        accentColor="#E8A33D"
        onOpenHistory={onOpenHistory}
      />,
    );

    expect(screen.getByTestId('progress-consistency-goal')).toHaveTextContent(
      'Workouts a week, the last 12 weeks',
    );
    fireEvent.press(screen.getByTestId('progress-consistency-history'));
    expect(onOpenHistory).toHaveBeenCalled();
  });
});
