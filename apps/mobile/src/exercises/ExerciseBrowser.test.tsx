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

  it('offers equipment to filter by when the caller can change it, each with what it finds', () => {
    const onEquipmentChange = jest.fn();
    renderBrowser({ onEquipmentChange });
    fireEvent.press(screen.getByTestId('exercise-browser-filters-equipment'));
    // Only equipment something is done with; the person's own exercise records none.
    expect(screen.getByTestId('exercise-browser-filters-option-barbell')).toHaveTextContent(/2/);
    expect(screen.getByTestId('exercise-browser-filters-option-dumbbell')).toHaveTextContent(/1/);
    expect(screen.queryByTestId('exercise-browser-filters-option-cable')).toBeNull();
    fireEvent.press(screen.getByTestId('exercise-browser-filters-option-dumbbell'));
    expect(onEquipmentChange).toHaveBeenCalledWith('dumbbell');
  });

  it('has no equipment filter where the caller cannot change it', () => {
    renderBrowser();
    expect(screen.getByTestId('exercise-browser-filters-muscle')).toBeTruthy();
    expect(screen.queryByTestId('exercise-browser-filters-equipment')).toBeNull();
  });

  it('filters by equipment from the rows in hand, as it does by muscle', () => {
    renderBrowser({ onEquipmentChange: jest.fn(), equipment: 'barbell' });
    expect(screen.getByTestId('exercise-item-skull')).toBeTruthy();
    expect(screen.getByTestId('exercise-item-bench')).toBeTruthy();
    expect(screen.queryByTestId('exercise-item-kickback')).toBeNull();
    expect(screen.queryByTestId('exercise-item-mine')).toBeNull();
    expect(screen.getByTestId('exercise-browser-filters-equipment')).toHaveTextContent(/Barbell/);
  });

  it('filters by movement -- the built-ins’ own -- leaving out exercises with none', () => {
    renderBrowser({
      rows: rows.map((r) =>
        r.id === 'bench'
          ? { ...r, movementPattern: 'horizontal_push' }
          : r.id === 'mine'
            ? r
            : { ...r, movementPattern: 'triceps_extension' },
      ),
    });
    fireEvent.press(screen.getByTestId('exercise-browser-filters-movement'));
    expect(screen.getByTestId('exercise-browser-filters-option-push')).toHaveTextContent(/1/);
    expect(screen.getByTestId('exercise-browser-filters-option-isolation')).toHaveTextContent(/2/);
    expect(screen.queryByTestId('exercise-browser-filters-option-hinge')).toBeNull();
    fireEvent.press(screen.getByTestId('exercise-browser-filters-option-push'));
    expect(screen.getByTestId('exercise-item-bench')).toBeTruthy();
    expect(screen.queryByTestId('exercise-item-mine')).toBeNull();
    expect(screen.queryByTestId('exercise-item-skull')).toBeNull();
    // Clear puts every exercise back.
    fireEvent.press(screen.getByTestId('exercise-browser-filters-clear'));
    expect(screen.getByTestId('exercise-item-mine')).toBeTruthy();
  });

  it('browses by muscle in the library: a tile for each group with exercises, a tap choosing it', () => {
    const onMuscleGroupChange = jest.fn();
    renderBrowser({ browseByMuscle: true, onMuscleGroupChange });
    expect(screen.getByTestId('exercise-browser-muscle-browse-triceps')).toHaveTextContent(/3/);
    expect(screen.getByTestId('exercise-browser-muscle-browse-chest')).toHaveTextContent(/1/);
    expect(screen.queryByTestId('exercise-browser-muscle-browse-back')).toBeNull();
    fireEvent.press(screen.getByTestId('exercise-browser-muscle-browse-triceps'));
    expect(onMuscleGroupChange).toHaveBeenCalledWith('triceps');
  });

  it('keeps Browse by Muscle with a muscle chosen -- that tile outlined, every other still there', () => {
    const onMuscleGroupChange = jest.fn();
    renderBrowser({ browseByMuscle: true, muscleGroup: 'triceps', onMuscleGroupChange });
    expect(screen.getByTestId('exercise-browser-muscle-browse-triceps-chosen')).toBeTruthy();
    expect(screen.getByTestId('exercise-browser-muscle-browse-chest')).toBeTruthy();
    expect(screen.queryByTestId('exercise-browser-muscle-browse-chest-chosen')).toBeNull();
    // The list is that muscle's; a tap on its tile again shows every muscle.
    expect(screen.queryByTestId('exercise-item-bench')).toBeNull();
    fireEvent.press(screen.getByTestId('exercise-browser-muscle-browse-triceps'));
    expect(onMuscleGroupChange).toHaveBeenCalledWith(null);
    fireEvent.press(screen.getByTestId('exercise-browser-muscle-browse-chest'));
    expect(onMuscleGroupChange).toHaveBeenLastCalledWith('chest');
  });

  it('has no muscle pill where Browse by Muscle is the muscle filter, and one where it is not', () => {
    const { unmount } = renderBrowser({ browseByMuscle: true });
    expect(screen.queryByTestId('exercise-browser-filters-muscle')).toBeNull();
    expect(screen.getByTestId('exercise-browser-muscle-browse')).toBeTruthy();
    unmount();
    renderBrowser();
    expect(screen.getByTestId('exercise-browser-filters-muscle')).toBeTruthy();
    expect(screen.queryByTestId('exercise-browser-muscle-browse')).toBeNull();
  });

  it('keeps Browse by Muscle while searching too', () => {
    renderBrowser({ browseByMuscle: true, searchInput: 'press' });
    expect(screen.getByTestId('exercise-browser-muscle-browse')).toBeTruthy();
  });

  it('shows placeholder tiles and rows while the exercises are read', () => {
    renderBrowser({ browseByMuscle: true, loading: true });
    expect(screen.getByTestId('exercise-library-loading')).toBeTruthy();
    expect(screen.getByTestId('exercise-browser-muscle-browse-loading')).toBeTruthy();
  });

  it('filters by grip -- neutral, pronated, supinated -- from the grip each records', () => {
    renderBrowser({
      rows: [
        row({ id: 'hammer', name: 'Seated Row', muscleGroup: 'back', grip: 'Close neutral' }),
        row({ id: 'pull', name: 'Pulldown', muscleGroup: 'back', grip: 'Wide overhand' }),
        row({ id: 'chin', name: 'Underhand Pulldown', muscleGroup: 'back', grip: 'Underhand' }),
        row({ id: 'none', name: 'Back Extension', muscleGroup: 'back' }),
      ],
    });
    fireEvent.press(screen.getByTestId('exercise-browser-filters-grip'));
    expect(screen.getByTestId('exercise-browser-filters-option-neutral')).toHaveTextContent(/1/);
    expect(screen.getByTestId('exercise-browser-filters-option-pronated')).toHaveTextContent(/1/);
    expect(screen.getByTestId('exercise-browser-filters-option-supinated')).toHaveTextContent(/1/);
    fireEvent.press(screen.getByTestId('exercise-browser-filters-option-pronated'));
    expect(screen.getByTestId('exercise-item-pull')).toBeTruthy();
    expect(screen.queryByTestId('exercise-item-hammer')).toBeNull();
    expect(screen.queryByTestId('exercise-item-none')).toBeNull();
    expect(screen.getByTestId('exercise-browser-filters-grip')).toHaveTextContent(/Pronated/);
  });

  it('filters by handle, offering only the handles the exercises have', () => {
    renderBrowser({
      rows: [
        row({ id: 'v', name: 'Row V', muscleGroup: 'back', attachment: 'V-handle' }),
        row({ id: 'rope', name: 'Pushdown', muscleGroup: 'triceps', attachment: 'Rope' }),
        row({ id: 'd', name: 'Fly', muscleGroup: 'chest', attachment: 'D-handles' }),
        row({ id: 'ball', name: 'Twist', muscleGroup: 'core', attachment: 'Medicine ball' }),
      ],
    });
    fireEvent.press(screen.getByTestId('exercise-browser-filters-handle'));
    expect(screen.getByTestId('exercise-browser-filters-option-v_handle')).toBeTruthy();
    expect(screen.getByTestId('exercise-browser-filters-option-rope')).toBeTruthy();
    expect(screen.getByTestId('exercise-browser-filters-option-d_handle')).toBeTruthy();
    // Not built into any of these: never offered.
    expect(screen.queryByTestId('exercise-browser-filters-option-straight_bar')).toBeNull();
    fireEvent.press(screen.getByTestId('exercise-browser-filters-option-rope'));
    expect(screen.getByTestId('exercise-item-rope')).toBeTruthy();
    expect(screen.queryByTestId('exercise-item-v')).toBeNull();
  });

  it('clears every filter at once, a muscle chosen from Browse by Muscle too', () => {
    const onMuscleGroupChange = jest.fn();
    renderBrowser({ browseByMuscle: true, muscleGroup: 'triceps', onMuscleGroupChange });
    fireEvent.press(screen.getByTestId('exercise-browser-filters-clear'));
    expect(onMuscleGroupChange).toHaveBeenCalledWith(null);
  });

  it('has no Also Works section: a muscle filter is the primary muscle group alone', () => {
    renderBrowser({ muscleGroup: 'triceps' });
    expect(screen.queryByText(/Also Works/)).toBeNull();
  });
});

describe('ExerciseBrowser and a search', () => {
  it("shows a search's matches and related exercises under their own headings, matches first", () => {
    renderBrowser({
      searchInput: 'skull crusher',
      rows: [
        { ...rows[1], searchKind: 'match' },
        { ...rows[0], searchKind: 'related' },
      ],
    });
    expect(screen.getByTestId('exercise-library-section-Best Matches')).toBeTruthy();
    expect(screen.getByTestId('exercise-library-section-Related Exercises')).toBeTruthy();
    expect(screen.queryByTestId('exercise-library-section-B')).toBeNull();
    expect(screen.getByTestId('exercise-library-count')).toHaveTextContent('1 match · 1 related');
  });

  it('says when there are no matches, only related exercises', () => {
    renderBrowser({
      searchInput: 'zz',
      rows: [{ ...rows[0], searchKind: 'related' }],
    });
    expect(screen.queryByTestId('exercise-library-section-Best Matches')).toBeNull();
    expect(screen.getByTestId('exercise-library-count')).toHaveTextContent(
      'No matches · 1 related',
    );
  });

  it('lists A-Z as before with no search', () => {
    renderBrowser();
    expect(screen.getByTestId('exercise-library-section-B')).toBeTruthy();
    expect(screen.getByTestId('exercise-library-count')).toHaveTextContent('4 exercises');
  });
});
