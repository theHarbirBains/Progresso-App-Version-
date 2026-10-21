import type { PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchIntakeForRange } from '../nutrition/foodLogQueries';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { NutritionGoalsProvider } from '../nutrition/NutritionGoalsProvider';
import { PhaseProvider } from '../phases/PhaseProvider';
import { fetchPhases } from '../phases/phaseQueries';
import { dayKey } from '../phases/phaseRules';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ConsistencyBlock } from './ConsistencyBlock';
import { NutritionProgressSection, nutritionDays } from './NutritionProgressSection';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../nutrition/foodLogQueries', () => ({ fetchIntakeForRange: jest.fn() }));
jest.mock('../nutrition/nutritionGoalQueries', () => ({ fetchNutritionGoals: jest.fn() }));
jest.mock('../phases/phaseQueries', () => ({ fetchPhases: jest.fn() }));

function Providers({ children }: PropsWithChildren) {
  return (
    <NutritionGoalsProvider>
      <PhaseProvider>{children}</PhaseProvider>
    </NutritionGoalsProvider>
  );
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
  (fetchPhases as jest.Mock).mockResolvedValue([]);
  (fetchIntakeForRange as jest.Mock).mockReset().mockResolvedValue([]);
});

describe('nutritionDays', () => {
  it('adds each day up, newest first, with the target in force that day', () => {
    const days = nutritionDays(
      [
        { loggedAt: ago(1), calories: 800, proteinG: 50 },
        { loggedAt: ago(1), calories: 1100, proteinG: 70 },
        { loggedAt: ago(0), calories: 2500, proteinG: 150 },
      ],
      (key) => (key === dayKey(new Date()) ? 1800 : 2000),
    );

    expect(days.map((day) => [day.calories, day.proteinG, day.calorieTarget])).toEqual([
      [2500, 150, 1800],
      [1900, 120, 2000],
    ]);
  });
});

describe('NutritionProgressSection', () => {
  it('sums up the week over the days logged, and opens a day to see its foods', async () => {
    (fetchIntakeForRange as jest.Mock).mockResolvedValue([
      { loggedAt: ago(0), calories: 1950, proteinG: 140 },
      { loggedAt: ago(2), calories: 2500, proteinG: 100 },
    ]);
    const onOpenDay = jest.fn();
    render(
      <NutritionProgressSection accentColor="#E8A33D" onAccentColor="#000" onOpenDay={onOpenDay} />,
      { wrapper: Providers },
    );

    expect(await screen.findByTestId('progress-nutrition-logged')).toHaveTextContent(/2 of 7/);
    await waitFor(() =>
      expect(screen.getByTestId('progress-nutrition-on-target')).toHaveTextContent(/1 of 2/),
    );
    expect(screen.getByTestId('progress-nutrition-avg-calories')).toHaveTextContent(/2,225/);
    expect(screen.getByTestId('progress-nutrition-avg-protein')).toHaveTextContent(/120g/);
    const twoDaysAgo = dayKey(new Date(ago(2)));
    expect(screen.getByTestId(`progress-nutrition-day-${twoDaysAgo}`)).toHaveTextContent(
      /500 over/,
    );
    fireEvent.press(screen.getByTestId(`progress-nutrition-day-${twoDaysAgo}`));
    expect(onOpenDay).toHaveBeenCalledWith(twoDaysAgo);
    expectNoBareText();
  });

  it('reads a longer time when it is chosen, and says when nothing was logged', async () => {
    render(
      <NutritionProgressSection accentColor="#E8A33D" onAccentColor="#000" onOpenDay={jest.fn()} />,
      { wrapper: Providers },
    );

    expect(await screen.findByTestId('progress-nutrition-empty')).toHaveTextContent(
      'No food logged in this time.',
    );
    fireEvent.press(screen.getByTestId('progress-nutrition-range-quarter'));

    await waitFor(() => expect(fetchIntakeForRange).toHaveBeenCalledTimes(2));
    const [, start, end] = (fetchIntakeForRange as jest.Mock).mock.calls[1]!;
    expect(Math.round(((end as Date).getTime() - (start as Date).getTime()) / 86400000)).toBe(90);
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
