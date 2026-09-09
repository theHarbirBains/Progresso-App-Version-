import { fireEvent, render, screen } from '@testing-library/react-native';
import { StrengthJourneySection } from './StrengthJourneySection';

const benchGroup = {
  exerciseId: 'ex-bench',
  exerciseName: 'Bench Press',
  sets: [
    { weightKg: 100, reps: 5, performedAt: '2026-01-01T12:00:00Z', workoutExerciseId: 'we1' },
    { weightKg: 120, reps: 5, performedAt: '2026-02-15T12:00:00Z', workoutExerciseId: 'we2' },
  ],
};

function renderChart(overrides: Partial<Parameters<typeof StrengthJourneySection>[0]> = {}) {
  return render(
    <StrengthJourneySection
      groups={[benchGroup]}
      weightUnit="kg"
      accentColor="#2F80FF"
      onAccentColor="#FFFFFF"
      destructiveColor="#F0555C"
      oneRepMaxes={[]}
      repPRs={[]}
      testIDPrefix="progress-test"
      {...overrides}
    />,
  );
}

describe('StrengthJourneySection', () => {
  beforeEach(() => {
    // Pinned so the default 3-month range includes both fixed test dates
    // (2026-01-01/2026-02-15) regardless of when the suite actually runs.
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('auto-selects the most-trained exercise and shows its current top set', async () => {
    renderChart();

    expect(await screen.findByTestId('progress-test-exercise-selector')).toHaveTextContent(
      /Bench Press/,
    );
    expect(screen.getByTestId('progress-test-current')).toHaveTextContent('120kg × 5');
    expect(screen.getByTestId('progress-test-delta')).toHaveTextContent(
      '+20kg since first recorded',
    );
  });

  it('renders the interactive chart and reveals point detail on tap', async () => {
    renderChart();
    await screen.findByTestId('progress-test-chart');

    fireEvent(screen.getByTestId('progress-test-chart'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 280, height: 160 } },
    });
    fireEvent.press(screen.getByTestId('progress-test-chart-point-1'));

    expect(await screen.findByTestId('progress-test-point-detail')).toHaveTextContent(/120kg × 5/);
  });

  it('does not show the metrics grid or per-exercise milestones unless detailed', async () => {
    renderChart({ detailed: false });
    await screen.findByTestId('progress-test-current');

    expect(screen.queryByTestId('progress-test-metric-topset')).toBeNull();
    expect(screen.queryByTestId('progress-test-milestone-0')).toBeNull();
  });

  it('shows the metrics grid and per-exercise milestones when detailed', async () => {
    renderChart({
      detailed: true,
      repPRs: [
        {
          reps: 5,
          bestWeightKg: 120,
          sourceSetId: 'set-1',
          achievedAt: '2026-02-15T12:00:00Z',
          exerciseId: 'ex-bench',
          exerciseName: 'Bench Press',
        },
      ],
    });

    expect(await screen.findByTestId('progress-test-metric-topset')).toHaveTextContent(/120/);
    expect(screen.getByTestId('progress-test-metric-1rm')).toHaveTextContent(/No 1RM recorded yet/);
    expect(screen.getByTestId('progress-test-metric-prs')).toHaveTextContent(/1/);
    expect(screen.getByTestId('progress-test-milestone-0')).toHaveTextContent(/First recorded/);
  });

  it('shows an empty state when no set falls within the selected time range', () => {
    renderChart({
      groups: [
        {
          ...benchGroup,
          sets: [
            {
              weightKg: 90,
              reps: 5,
              performedAt: '2024-01-01T12:00:00Z',
              workoutExerciseId: 'we0',
            },
          ],
        },
      ],
    });

    expect(screen.getByTestId('progress-test-chart-empty')).toBeTruthy();
  });
});
