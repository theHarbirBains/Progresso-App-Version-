import { fireEvent, render, screen } from '@testing-library/react-native';
import { setBuiltinSources } from './builtinExtras';
import { ExerciseBrowser } from './ExerciseBrowser';
import type { ExerciseRow } from './exerciseQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const row = (over: Partial<ExerciseRow>): ExerciseRow => ({
  id: 'id',
  name: 'Name',
  muscleGroup: 'chest',
  movementType: 'bilateral',
  loggingStyle: null,
  measurementType: 'weight_reps',
  photoUrl: null,
  isActive: true,
  createdBy: null,
  ...over,
});

const rows: ExerciseRow[] = [
  row({
    id: 'kickback',
    name: 'Dumbbell Kickback',
    muscleGroup: 'triceps',
    equipment: 'dumbbell',
    slug: 'db-kickback',
  }),
  row({
    id: 'skull',
    name: 'Barbell Skull Crusher',
    muscleGroup: 'triceps',
    equipment: 'barbell',
    slug: 'bb-skull-crusher',
  }),
  row({
    id: 'bench',
    name: 'Barbell Bench Press',
    muscleGroup: 'chest',
    equipment: 'barbell',
    slug: 'bb-bench-press',
    secondaryMuscleGroups: ['shoulders', 'triceps'],
  }),
  row({ id: 'mine', name: 'My Cable Pushdown', muscleGroup: 'triceps', createdBy: 'user-1' }),
];

function renderBrowser(over: Partial<Parameters<typeof ExerciseBrowser>[0]> = {}) {
  return render(
    <ExerciseBrowser
      searchInput=""
      onSearchChange={jest.fn()}
      muscleGroup={null}
      onMuscleGroupChange={jest.fn()}
      source="all"
      onSourceChange={jest.fn()}
      sourceCounts={null}
      rows={rows}
      loading={false}
      error={null}
      onRetry={jest.fn()}
      accent={{ color: '#D99A50', background: '#2A2018', onColor: '#12110F' }}
      {...over}
    />,
  );
}

beforeAll(() => setBuiltinSources(null));

describe('ExerciseBrowser and the built-in library', () => {
  it('shows each built-in with its illustrated instructor, and a person’s own as before', () => {
    renderBrowser();
    expect(screen.getByTestId('exercise-item-kickback-photo-illustration')).toBeTruthy();
    expect(screen.getByTestId('exercise-item-bench-photo-illustration')).toBeTruthy();
    expect(screen.queryByTestId('exercise-item-mine-photo-illustration')).toBeNull();
  });

  it('opens how to do a built-in from its picture', () => {
    renderBrowser();
    fireEvent.press(screen.getByTestId('exercise-item-kickback-photo-guide'));
    expect(screen.getByTestId('exercise-item-kickback-photo-guide-sheet')).toBeTruthy();
  });

  it('offers equipment to filter by when the caller can change it', () => {
    const onEquipmentChange = jest.fn();
    renderBrowser({ onEquipmentChange });
    fireEvent.press(screen.getByText('Dumbbell'));
    expect(onEquipmentChange).toHaveBeenCalledWith('dumbbell');
  });

  it('lists a muscle’s own exercises first, then under Also Works the built-ins that also work it', () => {
    renderBrowser({ muscleGroup: 'triceps' });
    expect(screen.getByTestId('exercise-library-section-also-works')).toHaveTextContent(
      'Also Works Triceps',
    );
    // Its own three counted; the bench press listed under Also Works, not among them.
    expect(screen.getByTestId('exercise-library-count')).toHaveTextContent('3 exercises');
  });

  it('has no Also Works heading without a muscle chosen', () => {
    renderBrowser();
    expect(screen.queryByTestId('exercise-library-section-also-works')).toBeNull();
  });
});
