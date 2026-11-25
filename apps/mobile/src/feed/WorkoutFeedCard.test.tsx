import { render, screen } from '@testing-library/react-native';
import type { CardioValues } from '../cardio/cardioActivities';
import { WorkoutFeedCard, type WorkoutCardData } from './WorkoutFeedCard';

const run: CardioValues = {
  activity: 'outdoor_run',
  name: null,
  durationSeconds: 1800,
  distanceM: 5000,
  speedKmh: null,
  speedSetting: null,
  inclinePercent: null,
  resistanceLevel: null,
  floors: null,
  steps: null,
  strokeRate: null,
  poolLengthM: null,
  laps: null,
  notes: null,
};

const workout = (extra: Partial<WorkoutCardData> = {}): WorkoutCardData => ({
  id: 'w1',
  name: 'Push Day',
  muscleGroups: [],
  durationMinutes: 75,
  completedExerciseCount: 3,
  completedSetCount: 12,
  topSets: [],
  ...extra,
});

function renderCard(data: WorkoutCardData) {
  render(
    <WorkoutFeedCard
      idPrefix="card"
      workout={data}
      authorName="Sam"
      timestamp="2026-11-20T10:00:00Z"
      weightUnit="kg"
    />,
  );
}

describe('WorkoutFeedCard', () => {
  it('shows a strength workout as it always has: its duration, exercises and sets', () => {
    renderCard(workout());
    expect(screen.getByTestId('card-w1-duration')).toHaveTextContent(/1h 15m/);
    expect(screen.getByTestId('card-w1-sets')).toHaveTextContent(/12/);
    expect(screen.queryByTestId('card-w1-cardio')).toBeNull();
  });

  it('shows its cardio, and its total time -- the lifting and the cardio together', () => {
    renderCard(workout({ cardio: [run], totalMinutes: 65 }));
    expect(screen.getByTestId('card-w1-duration')).toHaveTextContent(/1h 5m\s*Duration/);
    expect(screen.queryByText('Active')).toBeNull();
    expect(screen.getByTestId('card-w1-sets')).toHaveTextContent(/12/);
    // Its activity's glyph beside it, then its name and figures.
    expect(screen.getByTestId('card-w1-cardio')).toHaveTextContent(
      /Outdoor Running · 30 min · 5 km · 6:00 \/km$/,
    );
  });

  it('counts activities, not exercises and sets, for cardio alone', () => {
    renderCard(
      workout({
        completedExerciseCount: 0,
        completedSetCount: 0,
        cardio: [run],
        totalMinutes: 30,
      }),
    );
    expect(screen.getByTestId('card-w1-duration')).toHaveTextContent(/30 min/);
    expect(screen.getByTestId('card-w1-activities')).toHaveTextContent(/1/);
    expect(screen.queryByTestId('card-w1-sets')).toBeNull();
  });
});
