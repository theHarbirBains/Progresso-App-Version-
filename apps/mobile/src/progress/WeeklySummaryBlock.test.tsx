import { fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import type { WeekSummaries } from './useWeeklySummaries';
import { computeWeeklySummary, weekRange, type WeeklySummary } from './weeklySummary';
import { WeeklySummaryBlock, weekLabel } from './WeeklySummaryBlock';

const NOW = new Date(2026, 9, 21, 15, 0);
const THIS_WEEK = weekRange(NOW);
const LAST_WEEK = weekRange(NOW, 1);

const busyWeek: WeeklySummary = {
  training: { workoutDays: 3, workouts: 3, sets: 48, goalDays: 4 },
  nutrition: {
    loggedDays: 3,
    avgCalories: 2067,
    avgProteinG: 150,
    daysWithinCalories: 2,
    daysProteinMet: 2,
    budget: { consumed: 6200, target: 14000, remaining: 7800, percent: 0.44 },
  },
  muscleGroups: [{ group: 'chest', label: 'Chest', sets: 14, averageSets: 10 }],
  strength: [
    {
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      top: { weightKg: 85, reps: 6 },
      previousBest: { weightKg: 82.5, reps: 8 },
    },
    {
      exerciseId: 'squat',
      exerciseName: 'Squat',
      top: { weightKg: 100, reps: 5 },
      previousBest: null,
    },
  ],
  isEmpty: false,
};

const emptyWeek = computeWeeklySummary({
  week: LAST_WEEK,
  workouts: [],
  sets: [],
  foodLogs: [],
  dailyCalorieTarget: null,
  dailyProteinTarget: null,
  weeklyWorkoutGoal: null,
});

const summaries: WeekSummaries = {
  thisWeek: { range: THIS_WEEK, summary: busyWeek },
  lastWeek: { range: LAST_WEEK, summary: emptyWeek },
};

function renderBlock(props: Partial<Parameters<typeof WeeklySummaryBlock>[0]> = {}) {
  render(
    <WeeklySummaryBlock
      summaries={summaries}
      error={null}
      weightUnit="kg"
      accentColor="#E8A33D"
      onAccentColor="#000000"
      {...props}
    />,
  );
}

describe('weekLabel', () => {
  it('names the week by its Monday and Sunday', () => {
    expect(weekLabel(THIS_WEEK)).toBe('Oct 19 – 25');
    expect(weekLabel(weekRange(new Date(2026, 9, 1)))).toBe('Sep 28 – Oct 4');
  });
});

describe('WeeklySummaryBlock', () => {
  it('opens on this week, with its dates', () => {
    renderBlock();

    expect(screen.getByTestId('weekly-summary-dates')).toHaveTextContent('Oct 19 – 25');
    expect(
      screen.getByTestId('weekly-summary-week-thisWeek').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('shows training against the weekly goal, and nutrition over the days food was logged', () => {
    renderBlock();

    expect(screen.getByTestId('weekly-summary-workout-days')).toHaveTextContent(/3 of 4/);
    expect(screen.getByTestId('weekly-summary-sets')).toHaveTextContent(/48/);
    expect(screen.getByTestId('weekly-summary-avg-calories')).toHaveTextContent(/2,067/);
    expect(screen.getByTestId('weekly-summary-avg-protein')).toHaveTextContent(/150g/);
    expect(screen.getByTestId('weekly-summary-calorie-days')).toHaveTextContent(/2 of 3/);
    expect(screen.getByTestId('weekly-summary-protein-days')).toHaveTextContent(/2 of 3/);
    expect(screen.getByTestId('weekly-summary-logged-days')).toHaveTextContent(
      'Out of 3 days with food logged · 6,200 of 14,000 cal for the week',
    );
  });

  it('shows sets per muscle group against the weeks before, and the main lifts in the chosen unit', () => {
    renderBlock({ weightUnit: 'lb' });

    expect(screen.getByTestId('weekly-summary-group-chest')).toHaveTextContent(/14 sets/);
    expect(screen.getByTestId('weekly-summary-group-chest')).toHaveTextContent(/4-week avg 10/);
    expect(screen.getByTestId('weekly-summary-lift-bench')).toHaveTextContent(/187.4 lb × 6/);
    expect(screen.getByTestId('weekly-summary-lift-bench')).toHaveTextContent(
      /Best of the 4 weeks before: 181.9 lb × 8/,
    );
    expect(screen.getByTestId('weekly-summary-lift-squat')).toHaveTextContent(/First in 4 weeks/);
  });

  it('switches to last week, which says when nothing was logged', () => {
    renderBlock();

    fireEvent.press(screen.getByTestId('weekly-summary-week-lastWeek'));

    expect(screen.getByTestId('weekly-summary-dates')).toHaveTextContent('Oct 12 – 18');
    expect(screen.getByTestId('weekly-summary-empty')).toHaveTextContent(
      'Nothing was logged last week.',
    );
    expect(screen.queryByTestId('weekly-summary-training')).toBeNull();
  });

  it('leaves out what needs a target when there is none', () => {
    renderBlock({
      summaries: {
        ...summaries,
        thisWeek: {
          range: THIS_WEEK,
          summary: {
            ...busyWeek,
            training: { ...busyWeek.training, goalDays: null },
            nutrition: {
              ...busyWeek.nutrition,
              daysWithinCalories: null,
              daysProteinMet: null,
              budget: null,
            },
          },
        },
      },
    });

    expect(screen.getByTestId('weekly-summary-workout-days')).toHaveTextContent(/^3/);
    expect(screen.queryByTestId('weekly-summary-calorie-days')).toBeNull();
    expect(screen.getByTestId('weekly-summary-logged-days')).toHaveTextContent(
      'Out of 3 days with food logged',
    );
  });

  it('shows the loading and error states', () => {
    renderBlock({ summaries: null });
    expect(screen.getByTestId('weekly-summary-loading')).toBeTruthy();

    renderBlock({ summaries: null, error: 'network error' });
    expect(screen.getByTestId('weekly-summary-error')).toHaveTextContent('network error');
  });

  it('renders no bare text outside <Text>', () => {
    renderBlock();

    expectNoBareText();
  });
});
