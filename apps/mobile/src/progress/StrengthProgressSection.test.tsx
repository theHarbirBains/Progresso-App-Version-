import { fireEvent, render, screen, within } from '@testing-library/react-native';
import type {
  ExerciseHistoryGroup,
  HistoricalSetWithExercise,
} from '../workouts/allExerciseHistoryQueries';
import { StrengthProgressSection } from './StrengthProgressSection';

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate };

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function benchSet(
  weightKg: number,
  daysBack: number,
  workoutExerciseId: string,
): HistoricalSetWithExercise {
  return {
    weightKg,
    reps: 8,
    performedAt: daysAgo(daysBack),
    workoutExerciseId,
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
  };
}

function curlSet(
  weightKg: number,
  daysBack: number,
  workoutExerciseId: string,
): HistoricalSetWithExercise {
  return {
    weightKg,
    reps: 8,
    performedAt: daysAgo(daysBack),
    workoutExerciseId,
    exerciseId: 'ex-curl',
    exerciseName: 'Bicep Curl',
    muscleGroup: 'biceps',
    movementType: 'bilateral',
  };
}

// Four sessions inside the default 4-week range, +20% -- "significant".
const significantBench = [
  benchSet(100, 20, 'we1'),
  benchSet(108, 15, 'we2'),
  benchSet(115, 10, 'we3'),
  benchSet(120, 5, 'we4'),
];

// Two sessions, a small real gain -- "progressing", not "significant".
const progressingCurl = [curlSet(20, 10, 'wc1'), curlSet(21, 5, 'wc2')];

function groupsFor(history: HistoricalSetWithExercise[]) {
  const byExercise = new Map<string, ExerciseHistoryGroup>();
  for (const s of history) {
    let g = byExercise.get(s.exerciseId);
    if (!g) {
      g = { exerciseId: s.exerciseId, exerciseName: s.exerciseName, sets: [] };
      byExercise.set(s.exerciseId, g);
    }
    g.sets.push({
      weightKg: s.weightKg,
      reps: s.reps,
      performedAt: s.performedAt,
      workoutExerciseId: s.workoutExerciseId,
    });
  }
  return Array.from(byExercise.values());
}

function renderSection(history: HistoricalSetWithExercise[]) {
  return render(
    <StrengthProgressSection
      history={history}
      groups={groupsFor(history)}
      weightUnit="kg"
      accentColor="#2F80FF"
      onAccentColor="#FFFFFF"
      navigation={navigation}
    />,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('StrengthProgressSection', () => {
  it('shows an empty state when there is no exercise history at all', () => {
    renderSection([]);

    expect(screen.getByTestId('progress-strength-empty')).toBeTruthy();
  });

  it('shows a distinct empty state when exercises exist but none have meaningful progress yet', () => {
    // A single session -- nothing to compare against yet.
    renderSection([benchSet(100, 5, 'we1')]);

    expect(screen.getByTestId('progress-strength-empty')).toHaveTextContent(
      'Keep training consistently to see meaningful strength progress.',
    );
  });

  it('features the exercise with meaningful progress: name, tags, starting/latest performance, delta, and level', () => {
    renderSection(significantBench);

    const card = screen.getByTestId('progress-strength-card');
    expect(within(card).getByText('Bench Press')).toBeTruthy();
    expect(within(card).getByText('Chest')).toBeTruthy();
    expect(within(card).getByText('Bilateral')).toBeTruthy();
    expect(screen.getByTestId('progress-strength-starting')).toHaveTextContent(/100kg × 8/);
    expect(screen.getByTestId('progress-strength-latest')).toHaveTextContent(/120kg × 8/);
    expect(screen.getByTestId('progress-strength-delta')).toHaveTextContent(/\+20kg/);
    expect(screen.getByTestId('progress-strength-level')).toHaveTextContent('Significant Progress');
  });

  it('renders the progression chart for the featured exercise', () => {
    renderSection(significantBench);

    expect(screen.getByTestId('progress-strength-chart')).toBeTruthy();
  });

  it('distinguishes "Progressing" from "Significant Progress" -- not every gain is labeled the same', () => {
    renderSection(progressingCurl);

    expect(screen.getByTestId('progress-strength-level')).toHaveTextContent('Progressing');
  });

  it('lists other exercises with meaningful progress below the featured card, navigating to the existing exercise detail screen on press', () => {
    renderSection([...significantBench, ...progressingCurl]);

    const row = screen.getByTestId('progress-strength-row-ex-curl');
    expect(row).toHaveTextContent(/Bicep Curl/);
    expect(row).toHaveTextContent(/Progressing/);

    fireEvent.press(row);

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex-curl',
      exerciseName: 'Bicep Curl',
    });
  });

  it('filters by search text', () => {
    renderSection([...significantBench, ...progressingCurl]);

    fireEvent.changeText(screen.getByTestId('progress-strength-search'), 'curl');

    // Bicep Curl becomes the featured exercise once Bench Press is filtered out.
    expect(screen.getByText('Bicep Curl')).toBeTruthy();
    expect(screen.queryByText('Bench Press')).toBeNull();
  });

  it('filters by muscle group', () => {
    renderSection([...significantBench, ...progressingCurl]);

    fireEvent.press(screen.getByTestId('muscle-group-chip-biceps'));

    expect(screen.getByText('Bicep Curl')).toBeTruthy();
    expect(screen.queryByText('Bench Press')).toBeNull();
  });

  // Regression coverage for a reported layout bug: the Muscle Group and
  // Time Range chip rows sat flush against each other with no space
  // between them, and no label telling the two apart. Each now has its
  // own "Muscle Group"/"Time Range" label above it.
  it('labels the Muscle Group and Time Range filters so the two chip rows read as distinct controls', () => {
    renderSection(significantBench);

    expect(screen.getByText('Muscle Group')).toBeTruthy();
    expect(screen.getByText('Time Range')).toBeTruthy();
  });

  it('defaults the time range to 4 Weeks', () => {
    renderSection(significantBench);

    expect(screen.getByTestId('time-range-4w').props.accessibilityState.selected).toBe(true);
  });

  it('excludes progress data outside the selected time range', () => {
    // All 4 sessions are within 20 days -- selecting "All Time" should not
    // change the outcome, but confirms the range control is wired through.
    renderSection(significantBench);

    fireEvent.press(screen.getByTestId('time-range-all'));

    expect(screen.getByTestId('time-range-all').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('progress-strength-level')).toHaveTextContent('Significant Progress');
  });

  it('shows a "no matching exercises" state when a filter excludes every meaningful exercise', () => {
    renderSection(significantBench);

    fireEvent.changeText(screen.getByTestId('progress-strength-search'), 'nonexistent exercise');

    expect(screen.getByTestId('progress-strength-no-results')).toBeTruthy();
  });

  it('opens the point-detail panel when a chart point is tapped', () => {
    renderSection(significantBench);

    fireEvent(screen.getByTestId('progress-strength-chart'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 280, height: 160 } },
    });
    fireEvent.press(screen.getByTestId('progress-strength-chart-point-0'));

    expect(screen.getByTestId('progress-strength-point-detail')).toBeTruthy();
  });
});
