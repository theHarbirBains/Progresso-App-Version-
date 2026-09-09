import { render, screen } from '@testing-library/react-native';
import { StrengthSection } from './StrengthSection';

const theme = { accent: '#2F80FF', onAccent: '#FFFFFF' };

const benchGroup = {
  exerciseId: 'ex-bench',
  exerciseName: 'Bench Press',
  sets: [
    { weightKg: 100, reps: 5, performedAt: '2026-01-01T12:00:00Z', workoutExerciseId: 'we1' },
    { weightKg: 120, reps: 5, performedAt: '2026-02-15T12:00:00Z', workoutExerciseId: 'we2' },
  ],
};

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-03-01T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

function renderStrength(overrides: Partial<Parameters<typeof StrengthSection>[0]> = {}) {
  return render(
    <StrengthSection
      groups={[benchGroup]}
      weightUnit="kg"
      theme={theme}
      oneRepMaxes={[]}
      repPRs={[]}
      muscleGroupCounts={[{ group: 'chest', label: 'Chest', count: 3 }]}
      muscleGroupVisualization={['chest']}
      {...overrides}
    />,
  );
}

describe('StrengthSection', () => {
  it('shows the empty state with no workout history', () => {
    renderStrength({ groups: [], muscleGroupCounts: [] });

    expect(screen.getByTestId('progress-strength-empty')).toHaveTextContent(
      'Log a workout to start tracking your strength.',
    );
  });

  it('shows the detailed Strength Journey chart, including the metrics grid', () => {
    renderStrength();

    expect(screen.getByTestId('progress-strength-exercise-selector')).toHaveTextContent(
      /Bench Press/,
    );
    expect(screen.getByTestId('progress-strength-metric-topset')).toHaveTextContent(/120/);
  });

  it('shows real per-muscle-group completed-set counts, most-trained first', () => {
    renderStrength({
      muscleGroupCounts: [
        { group: 'chest', label: 'Chest', count: 3 },
        { group: 'back', label: 'Back', count: 1 },
      ],
    });

    expect(screen.getByTestId('progress-muscle-group-chest')).toHaveTextContent(/3 sets/);
    expect(screen.getByTestId('progress-muscle-group-back')).toHaveTextContent(/1 set/);
    expect(screen.getByTestId('progress-muscle-visualization')).toBeTruthy();
  });

  it('never shows the Muscle Group Progress section with no muscle data', () => {
    renderStrength({ muscleGroupCounts: [] });

    expect(screen.queryByText('Muscle Group Progress')).toBeNull();
  });
});
