import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import type { MuscleGroup } from '../exercises/muscleGroups';
import type { PreviousMuscleGroup } from './previousExercises';
import { PreviousExercisesSection } from './PreviousExercisesSection';
import type { PreviousExercisesState } from './usePreviousExercises';

let mockGender: string | null = 'female';
jest.mock('../profile/profileContext', () => ({
  useProfileIfAny: () => ({ gender: mockGender }),
}));

const row = (id: string, name: string, muscleGroup: MuscleGroup): ExerciseRow => ({
  id,
  name,
  muscleGroup,
  movementType: 'bilateral',
  loggingStyle: null,
  measurementType: 'weight_reps',
  photoUrl: null,
  isActive: true,
  createdBy: 'user-1',
  equipment: 'machine',
  loadType: 'plate_loaded',
});

const library = new Map<string, ExerciseRow>([
  ['press', row('press', 'Leg Press', 'quadriceps')],
  ['ext', row('ext', 'Leg Extension', 'quadriceps')],
  ['curl', row('curl', 'Lying Leg Curl', 'hamstrings')],
]);

const done = (exerciseId: string, setCount: number, at: string) => ({
  exerciseId,
  performedAt: at,
  measurementType: 'weight_reps' as const,
  setCount,
  best: { id: `s-${exerciseId}`, setIndex: 1, weightKg: 200, reps: 7, completedAt: at, side: null },
  byTrainer: false,
});

const groups: PreviousMuscleGroup[] = [
  {
    muscleGroup: 'quadriceps',
    lastTrainedAt: '2026-11-23T10:00:00Z',
    exercises: [done('press', 2, '2026-11-23T10:00:00Z'), done('ext', 2, '2026-11-23T10:00:00Z')],
  },
  {
    muscleGroup: 'hamstrings',
    lastTrainedAt: '2026-11-18T10:00:00Z',
    exercises: [done('curl', 3, '2026-11-18T10:00:00Z')],
  },
];

function state(over: Partial<PreviousExercisesState> = {}): PreviousExercisesState {
  return {
    status: 'ready',
    groups,
    dayGroups: ['quadriceps', 'hamstrings'],
    retry: jest.fn(),
    ...over,
  };
}

function renderSection(over: Partial<Parameters<typeof PreviousExercisesSection>[0]> = {}) {
  return render(
    <PreviousExercisesSection
      previous={state()}
      addedGroups={[]}
      library={library}
      alreadyAddedIds={new Set()}
      weightUnit="lb"
      onSelect={jest.fn()}
      sessionName="Lower Body"
      accentColor="#D99A50"
      {...over}
    />,
  );
}

describe('PreviousExercisesSection -- Last Time, after Harbir’s reference', () => {
  it('leads with the session: its name, when it was done, and what is below it, counted', () => {
    renderSection();
    expect(screen.getByTestId('previous-exercises-session')).toHaveTextContent(
      /YOUR PREVIOUS SESSION.*Lower Body/,
    );
    expect(screen.getByTestId('previous-exercises-date')).toHaveTextContent(/November 23, 2026/);
    expect(screen.getByTestId('previous-exercises-stat-groups')).toHaveTextContent(
      /2.*Muscle Groups/,
    );
    expect(screen.getByTestId('previous-exercises-stat-exercises')).toHaveTextContent(
      /3.*Exercises/,
    );
    expect(screen.getByTestId('previous-exercises-stat-sets')).toHaveTextContent(/7.*Total Sets/);
  });

  it('lists each muscle group under its heading, with when it was last trained', () => {
    renderSection();
    expect(screen.getByTestId('previous-exercises-group-quadriceps')).toHaveTextContent(
      /QUADRICEPS.*Last trained Nov 23/,
    );
    expect(screen.getByTestId('previous-exercises-group-quadriceps-press')).toHaveTextContent(
      /Leg Press.*Quadriceps · Machine · Plate loaded.*2 sets · Top set 440.*× 7/,
    );
  });

  it("shows one already in the workout as added, and doesn't add it twice", () => {
    const onSelect = jest.fn();
    renderSection({ onSelect, alreadyAddedIds: new Set(['press']) });
    const added = screen.getByTestId('previous-exercises-group-quadriceps-press');
    expect(added).toHaveTextContent(/Leg Press \(added\)/);
    fireEvent.press(added);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('previous-exercises-group-hamstrings-curl'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'curl' }));
  });

  it("draws the first muscle group's figure, its muscles tinted in the accent", () => {
    const { UNSAFE_root } = renderSection();
    const tinted = UNSAFE_root.findAll(
      (node: { props: Record<string, unknown> }) => node.props.tintColor === '#D99A50',
    );
    expect(tinted.length).toBeGreaterThan(0);
  });

  it('says it is the day’s muscle groups when the session has no name of its own', () => {
    renderSection({ sessionName: null });
    expect(screen.getByTestId('previous-exercises-title')).toHaveTextContent(
      'Quadriceps & Hamstrings',
    );
  });

  it('shows placeholders while it is read', () => {
    renderSection({ previous: state({ status: 'loading' }) });
    expect(screen.getByTestId('previous-exercises-loading')).toBeTruthy();
    expect(screen.queryByTestId('previous-exercises-session')).toBeNull();
  });

  afterAll(() => {
    mockGender = null;
  });
});
