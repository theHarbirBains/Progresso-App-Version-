import { FlatList } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { fetchWorkoutIdForSet } from './progressStatsQueries';
import { PRsSection } from './PRsSection';

jest.mock('./progressStatsQueries', () => ({
  fetchWorkoutIdForSet: jest.fn(),
}));

const mockFetchWorkoutIdForSet = fetchWorkoutIdForSet as jest.Mock;
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate };

const repPR = {
  reps: 5,
  bestWeightKg: 120,
  sourceSetId: 'set-1',
  achievedAt: '2026-02-15T12:00:00Z',
  exerciseId: 'ex-bench',
  exerciseName: 'Bench Press',
  muscleGroup: 'chest' as const,
};

beforeEach(() => {
  mockFetchWorkoutIdForSet.mockReset().mockResolvedValue(null);
  mockNavigate.mockClear();
});

describe('PRsSection', () => {
  it('shows the empty state with no PRs', () => {
    render(
      <PRsSection
        repPRs={[]}
        oneRepMaxes={[]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    expect(screen.getByTestId('progress-prs-empty')).toHaveTextContent(
      'Your personal records will appear here as you progress.',
    );
  });

  it('merges rep PRs and true 1RMs into one feed, sorted most recent first', () => {
    render(
      <PRsSection
        repPRs={[repPR]}
        oneRepMaxes={[
          {
            weightKg: 140,
            sourceSetId: 'set-orm',
            achievedAt: '2026-02-20T12:00:00Z',
            exerciseId: 'ex-bench',
            exerciseName: 'Bench Press',
          },
        ]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    expect(screen.getByTestId('progress-prs-count')).toHaveTextContent('2 PRs');
    // The 1RM (Feb 20) was achieved after the rep PR (Feb 15), so it must be first.
    expect(screen.getByTestId('progress-pr-row-orm-ex-bench')).toHaveTextContent(/140/);
  });

  it('navigates to exercise detail when a row is pressed', () => {
    render(
      <PRsSection
        repPRs={[repPR]}
        oneRepMaxes={[]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    fireEvent.press(screen.getByTestId(`progress-pr-row-pr-${repPR.exerciseId}-5`));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex-bench',
      exerciseName: 'Bench Press',
    });
  });

  it('shares the most recent PR by resolving it back to its source workout', async () => {
    mockFetchWorkoutIdForSet.mockResolvedValue('workout-42');
    render(
      <PRsSection
        repPRs={[repPR]}
        oneRepMaxes={[]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    fireEvent.press(screen.getByTestId('progress-share-recent-pr'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('ShareWorkout', { workoutId: 'workout-42' }),
    );
    expect(mockFetchWorkoutIdForSet).toHaveBeenCalledWith('set-1');
  });

  it('shows an error rather than navigating when the source workout cannot be resolved', async () => {
    mockFetchWorkoutIdForSet.mockResolvedValue(null);
    render(
      <PRsSection
        repPRs={[repPR]}
        oneRepMaxes={[]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    fireEvent.press(screen.getByTestId('progress-share-recent-pr'));

    expect(await screen.findByTestId('progress-share-error')).toHaveTextContent(
      'That workout is no longer available to share.',
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('ShareWorkout', expect.anything());
  });

  it('uses a FlatList by default (ProgressOverviewScreen, where this is the only scrollable content)', () => {
    render(
      <PRsSection
        repPRs={[repPR]}
        oneRepMaxes={[]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
      />,
    );

    expect(screen.UNSAFE_getByType(FlatList)).toBeTruthy();
  });

  // Regression guard: a FlatList nested inside another vertical ScrollView
  // (e.g. ProfileScreen, which wraps its whole page in one) breaks RN's own
  // windowing and triggers its documented warning. scrollable={false} must
  // render the identical rows without an inner VirtualizedList.
  it('renders a plain (non-virtualized) list instead of a FlatList when scrollable is false', () => {
    render(
      <PRsSection
        repPRs={[repPR]}
        oneRepMaxes={[]}
        weightUnit="kg"
        accentColor="#2F80FF"
        navigation={navigation}
        scrollable={false}
      />,
    );

    expect(screen.UNSAFE_queryAllByType(FlatList)).toHaveLength(0);
    expect(screen.getByTestId('progress-pr-row-pr-ex-bench-5')).toBeTruthy();
  });
});
