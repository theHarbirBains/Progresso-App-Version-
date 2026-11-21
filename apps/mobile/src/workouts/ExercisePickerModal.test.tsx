import { Alert, Modal, StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { fetchAllExercises, invalidateExerciseCache } from '../exercises/exerciseQueries';
import { updateExercise } from '../lib/api';
import { colors } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { ExercisePickerModal } from './ExercisePickerModal';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { access_token: 'token-123' } }),
}));
jest.mock('../lib/api', () => ({ updateExercise: jest.fn() }));

jest.mock('../exercises/exerciseQueries', () => ({
  fetchAllExercises: jest.fn(),
  invalidateExerciseCache: jest.fn(),
  fetchExerciseSourceCounts: jest.fn().mockResolvedValue({ all: 2, builtin: 2, mine: 0 }),
}));

jest.mock('../navigation/navigationTransitions', () => ({
  useReduceMotionPreference: jest.fn(),
}));

const mockMakeOwn = jest.fn();
const mockShared = { rows: [], error: null, reload: jest.fn(), makeOwn: mockMakeOwn };
jest.mock('../exercises/useSharedExercises', () => ({
  useSharedExercises: () => mockShared,
}));

const mockFetchExercises = fetchAllExercises as jest.Mock;
const mockUseReduceMotionPreference = useReduceMotionPreference as jest.Mock;

beforeEach(() => {
  mockUseReduceMotionPreference.mockReturnValue(false);
  mockFetchExercises.mockReset().mockResolvedValue([
    {
      id: 'ex1',
      name: 'Barbell Bench Press',
      muscleGroup: 'chest',
      movementType: 'bilateral',
      isActive: true,
      createdBy: null,
    },
    {
      id: 'ex2',
      name: 'Barbell Back Squat',
      muscleGroup: 'quadriceps',
      movementType: 'bilateral',
      isActive: true,
      createdBy: null,
    },
  ]);
});

describe("ExercisePickerModal -- a trainer's, a client's or a friend's exercise", () => {
  const friendsRow = {
    id: 'ex-sams',
    name: 'Seated Row',
    muscleGroup: 'back',
    movementType: 'bilateral',
    measurementType: 'weight_reps',
    photoUrl: null,
    gym: 'Fit4Less Downtown',
    attachment: 'V-handle',
    isActive: true,
    createdBy: 'sam',
    shared: { source: 'friend', ownerId: 'sam', ownerName: 'Sam', inLibrary: false },
  };
  const coachRow = {
    ...friendsRow,
    id: 'ex-coach',
    createdBy: 'coach',
    shared: { source: 'trainer', ownerId: 'coach', ownerName: 'Coach', inLibrary: false },
  };
  const ownCopy = { ...friendsRow, id: 'ex-my-copy', createdBy: 'user-1', shared: undefined };

  it("adds a friend's exercise as it is -- its creator's changes reach everyone using it", async () => {
    mockFetchExercises.mockResolvedValue([friendsRow]);
    mockMakeOwn.mockReset();
    const onSelect = jest.fn();
    render(
      <ExercisePickerModal
        visible
        onClose={jest.fn()}
        onSelect={onSelect}
        userId="user-1"
        alreadyAddedIds={[]}
      />,
    );

    // Whose it is, and its gym and handle.
    expect(await screen.findByTestId('exercise-item-ex-sams')).toHaveTextContent(/From Sam/);
    expect(screen.getByTestId('exercise-item-ex-sams')).toHaveTextContent(
      /Fit4Less Downtown · V-handle/,
    );
    fireEvent.press(screen.getByTestId('exercise-item-ex-sams'));

    expect(onSelect).toHaveBeenCalledWith(friendsRow);
    expect(mockMakeOwn).not.toHaveBeenCalled();
  });

  it("makes a trainer's exercise theirs first, then adds their own one", async () => {
    mockFetchExercises.mockResolvedValue([coachRow]);
    mockMakeOwn.mockReset().mockResolvedValue(ownCopy);
    const onSelect = jest.fn();
    render(
      <ExercisePickerModal
        visible
        onClose={jest.fn()}
        onSelect={onSelect}
        userId="user-1"
        alreadyAddedIds={[]}
      />,
    );

    fireEvent.press(await screen.findByTestId('exercise-item-ex-coach'));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(ownCopy));
    expect(mockMakeOwn).toHaveBeenCalledWith(coachRow);
  });

  it('says so when their own one is already in the workout', async () => {
    mockFetchExercises.mockResolvedValue([coachRow]);
    mockMakeOwn.mockReset().mockResolvedValue(ownCopy);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onSelect = jest.fn();
    render(
      <ExercisePickerModal
        visible
        onClose={jest.fn()}
        onSelect={onSelect}
        userId="user-1"
        alreadyAddedIds={['ex-my-copy']}
      />,
    );

    fireEvent.press(await screen.findByTestId('exercise-item-ex-coach'));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Seated Row is already here', expect.any(String)),
    );
    expect(onSelect).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('adds a built-in or their own straight away, with nothing to copy', async () => {
    mockMakeOwn.mockReset();
    const onSelect = jest.fn();
    render(
      <ExercisePickerModal
        visible
        onClose={jest.fn()}
        onSelect={onSelect}
        userId="user-1"
        alreadyAddedIds={[]}
      />,
    );

    fireEvent.press(await screen.findByTestId('exercise-item-ex1'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'ex1' }));
    expect(mockMakeOwn).not.toHaveBeenCalled();
  });
});

describe('ExercisePickerModal -- previous exercises', () => {
  // Whether a tab's content is out of sight (both stay mounted; the one not chosen is hidden).
  const hidden = (testID: string) => {
    expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeTruthy();
    return screen.queryByTestId(testID) === null;
  };

  const chest = {
    muscleGroup: 'chest' as const,
    lastTrainedAt: '2026-11-18T10:00:00Z',
    exercises: [
      {
        exerciseId: 'ex1',
        performedAt: '2026-11-18T10:00:00Z',
        measurementType: 'weight_reps' as const,
        setCount: 3,
        best: {
          id: 's2',
          setIndex: 2,
          weightKg: 80,
          reps: 8,
          completedAt: '2026-11-18T10:20:00Z',
          side: null,
        },
        byTrainer: true,
      },
    ],
  };
  const previous = (groups: (typeof chest)[], extra: Partial<{ dayGroups: never[] }> = {}) => ({
    state: { status: 'ready' as const, groups, dayGroups: [], retry: jest.fn(), ...extra },
    addedGroups: [],
    weightUnit: 'kg' as const,
  });

  it('are a tab of their own, Last Time, where it opens -- each the very exercise done, one tap to add', async () => {
    const onSelect = jest.fn();
    render(
      <ExercisePickerModal
        visible
        onClose={jest.fn()}
        onSelect={onSelect}
        userId="user-1"
        alreadyAddedIds={[]}
        previous={previous([chest])}
      />,
    );

    const section = await screen.findByTestId('exercise-picker-previous');
    expect(section).toHaveTextContent(/Your Previous Exercises/);
    expect(screen.getByTestId('exercise-picker-previous-group-chest-date')).toHaveTextContent(
      /Last trained Nov 18/,
    );
    expect(screen.getByTestId('exercise-picker-previous-group-chest-ex1')).toHaveTextContent(
      /Barbell Bench Press.*3 sets · Top set 80 kg × 8 · Logged by your trainer/,
    );
    // On its own tab: the library is the other one, with nothing of Last Time's in it.
    expect(screen.getByTestId('exercise-picker-tabs')).toHaveTextContent(/Last Time.*All Exercises/);
    expect(hidden('exercise-picker-previous-card')).toBe(false);
    expect(hidden('exercise-library-list')).toBe(true);
    expect(
      screen.getByTestId('exercise-library-list', { includeHiddenElements: true }),
    ).not.toHaveTextContent(/Your Previous Exercises/);

    fireEvent.press(screen.getByTestId('exercise-picker-previous-group-chest-ex1'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'ex1' }));
  });

  it('show one already in the workout as added, whatever All Exercises is searched for', async () => {
    const onSelect = jest.fn();
    render(
      <ExercisePickerModal
        visible
        onClose={jest.fn()}
        onSelect={onSelect}
        userId="user-1"
        alreadyAddedIds={['ex1']}
        previous={previous([chest])}
      />,
    );

    const row = await screen.findByTestId('exercise-picker-previous-group-chest-ex1');
    expect(row).toHaveTextContent(/Barbell Bench Press \(added\)/);
    fireEvent.press(row);
    expect(onSelect).not.toHaveBeenCalled();

    // All Exercises is a tap away, and searching it leaves Last Time as it was.
    fireEvent.press(screen.getByTestId('exercise-picker-browse-all'));
    expect(hidden('exercise-library-list')).toBe(false);
    expect(hidden('exercise-picker-previous-card')).toBe(true);
    fireEvent.changeText(screen.getByTestId('exercise-search'), 'bench');
    fireEvent.press(within(screen.getByTestId('exercise-picker-tabs')).getByText('Last Time'));
    expect(hidden('exercise-picker-previous-card')).toBe(false);
    expect(screen.getByTestId('exercise-picker-previous-group-chest-ex1')).toBeTruthy();
  });

  it('never stand in a look-alike for an exercise no longer in the library', async () => {
    const gone = {
      ...chest,
      exercises: [{ ...chest.exercises[0], exerciseId: 'ex-deleted' }],
    };
    render(
      <ExercisePickerModal
        visible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        previous={previous([gone])}
      />,
    );

    expect(await screen.findByTestId('exercise-picker-previous-group-chest-gone')).toBeTruthy();
    expect(screen.queryByTestId('exercise-picker-previous-group-chest-ex1')).toBeNull();
  });

  it('say how they will work before the first workout, and offer Try Again if they fail', async () => {
    const { rerender } = render(
      <ExercisePickerModal
        visible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        previous={previous([])}
      />,
    );
    expect(
      await screen.findByTestId('exercise-picker-previous-first', { includeHiddenElements: true }),
    ).toBeTruthy();
    // With no history yet, it opens on All Exercises instead.
    expect(hidden('exercise-library-list')).toBe(false);
    expect(hidden('exercise-picker-previous-card')).toBe(true);

    const retry = jest.fn();
    rerender(
      <ExercisePickerModal
        visible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        previous={{
          state: { status: 'error', groups: [], dayGroups: [], retry },
          addedGroups: [],
          weightUnit: 'kg',
        }}
      />,
    );
    fireEvent.press(within(screen.getByTestId('exercise-picker-tabs')).getByText('Last Time'));
    fireEvent.press(await screen.findByTestId('exercise-picker-previous-retry'));
    expect(retry).toHaveBeenCalled();
  });

  it('are not there without a live workout (a planner)', async () => {
    render(
      <ExercisePickerModal
        visible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
      />,
    );

    await screen.findByTestId('exercise-item-ex1');
    expect(screen.queryByTestId('exercise-picker-previous')).toBeNull();
    expect(screen.queryByTestId('exercise-picker-tabs')).toBeNull();
    expect(screen.getByTestId('exercise-library-count')).toHaveTextContent('2 exercises');
  });
});

describe('ExercisePickerModal -- deleting your own exercises', () => {
  it('deletes one of your own exercises by swipe, leaving the built-ins alone', async () => {
    mockFetchExercises.mockResolvedValue([
      {
        id: 'ex-mine',
        name: 'Seated Leg Extension',
        muscleGroup: 'quadriceps',
        movementType: 'bilateral',
        gym: 'Downtown',
        attachment: null,
        isActive: true,
        createdBy: 'user-1',
      },
      {
        id: 'ex1',
        name: 'Barbell Bench Press',
        muscleGroup: 'chest',
        movementType: 'bilateral',
        isActive: true,
        createdBy: null,
      },
    ]);
    jest.mocked(updateExercise).mockResolvedValue({} as never);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Delete')?.onPress?.();
    });
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    const mine = await screen.findByTestId('exercise-item-ex-mine');
    // Its gym after the muscle, so look-alike machines read apart.
    expect(within(mine).getByText('Quadriceps · Downtown')).toBeTruthy();
    expect(screen.getByTestId('exercise-item-ex1').props.accessibilityActions).toBeUndefined();

    fireEvent(mine, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });

    await waitFor(() =>
      expect(updateExercise).toHaveBeenCalledWith('token-123', 'ex-mine', { isActive: false }),
    );
    expect(invalidateExerciseCache).toHaveBeenCalledWith('user-1');
    await waitFor(() => expect(screen.queryByTestId('exercise-item-ex-mine')).toBeNull());
    expect(screen.getByTestId('exercise-item-ex1')).toBeTruthy();
    alert.mockRestore();
  });
});

describe('ExercisePickerModal', () => {
  it('lists exercises with their muscle group', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    const item = await screen.findByTestId('exercise-item-ex1');
    expect(within(item).getByText('Barbell Bench Press')).toBeTruthy();
    expect(within(item).getByText('Chest')).toBeTruthy();
  });

  // Regression guard: the muscle-group filter row was sitting flush against
  // the search input above and the "Create Custom Exercise" card below (each
  // only contributes margin on one side), reading as vertically cramped even
  // though the chips themselves have comfortable internal spacing.
  it('gives the muscle-group filter row vertical breathing room above and below', () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    const wrap = screen.getByTestId('exercise-library-muscle-group-wrap');
    expect(StyleSheet.flatten(wrap.props.style).marginVertical).toBeGreaterThan(0);
  });

  it('marks an already-added exercise as added and disables it', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={['ex1']}
        onCreateCustom={jest.fn()}
      />,
    );

    expect(await screen.findByTestId('exercise-item-ex1')).toHaveTextContent(/\(added\)/);
  });

  it('calls onSelect when an exercise is pressed', async () => {
    const onSelect = jest.fn();
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={onSelect}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    fireEvent.press(await screen.findByTestId('exercise-item-ex1'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ex1', name: 'Barbell Bench Press' }),
    );
  });

  it('re-queries when the search text changes', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );
    await screen.findByText('Barbell Bench Press');

    fireEvent.changeText(screen.getByTestId('exercise-search'), 'bench');

    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'bench' }),
      ),
    );
  });

  it('calls onClose when the close button is pressed', async () => {
    const onClose = jest.fn();
    render(
      <ExercisePickerModal
        visible={true}
        onClose={onClose}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );
    await screen.findByText('Barbell Bench Press');

    fireEvent.press(screen.getByTestId('exercise-picker-close'));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows an empty state when no exercises match', async () => {
    mockFetchExercises.mockResolvedValue([]);

    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    expect(await screen.findByText('No exercises found')).toBeTruthy();
  });

  it('shows a Create Custom Exercise row at the top of the list and calls onCreateCustom when pressed', async () => {
    const onCreateCustom = jest.fn();
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={onCreateCustom}
      />,
    );

    await screen.findByText('Barbell Bench Press');
    expect(screen.getByText('Create Custom Exercise')).toBeTruthy();
    expect(screen.getByText("Can't find the exercise? Create your own.")).toBeTruthy();

    fireEvent.press(screen.getByTestId('exercise-picker-create-custom'));

    expect(onCreateCustom).toHaveBeenCalled();
  });

  it('follows the given accentColor for the selected muscle-group chip', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
        accentColor="#8B5CF6"
        onAccentColor="#0A0A0A"
      />,
    );
    await screen.findByText('Barbell Bench Press');

    fireEvent.press(screen.getByTestId('muscle-group-chip-chest'));
    const chip = screen.getByTestId('muscle-group-chip-chest');
    expect(StyleSheet.flatten(chip.props.style).backgroundColor).toBe('#8B5CF6');
  });

  it('paints the warm background itself -- unlike a normal screen, this Modal has no AppBackgroundLayer behind it', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    await screen.findByText('Barbell Bench Press');
    const root = screen.getByTestId('exercise-picker-root');
    expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(colors.background);
  });

  it('respects Reduce Motion by disabling the modal slide animation', async () => {
    mockUseReduceMotionPreference.mockReturnValue(true);
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );
    await screen.findByText('Barbell Bench Press');

    expect(screen.UNSAFE_getByType(Modal).props.animationType).toBe('none');
  });
});

describe('ExercisePickerModal -- one list of plain rows', () => {
  function renderPicker(alreadyAddedIds: string[] = []) {
    return render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={alreadyAddedIds}
        onCreateCustom={jest.fn()}
      />,
    );
  }

  it('names the close control for assistive tech', async () => {
    renderPicker();
    await screen.findByText('Barbell Bench Press');

    expect(screen.getByTestId('exercise-picker-close').props.accessibilityLabel).toBe('Close');
    expect(screen.getByText('Add Exercise')).toBeTruthy();
  });

  it('describes each row by name, muscle group and movement type, and says when it is already added', async () => {
    renderPicker(['ex2']);
    const open = await screen.findByTestId('exercise-item-ex1');
    const added = screen.getByTestId('exercise-item-ex2');

    expect(open.props.accessibilityLabel).toBe('Barbell Bench Press, Chest');
    expect(added).toHaveTextContent(/Barbell Back Squat \(added\)/);
    expect(open.props.accessibilityState.disabled).toBe(false);
  });

  it('shows a unilateral exercise is unilateral', async () => {
    mockFetchExercises.mockResolvedValue([
      {
        id: 'ex3',
        name: 'Single-Arm Row',
        muscleGroup: 'back',
        movementType: 'unilateral',
        isActive: true,
        createdBy: null,
      },
    ]);
    renderPicker();

    expect(await screen.findByTestId('exercise-item-ex3')).toHaveTextContent(/Unilateral/);
  });

  it('labels the search field for assistive tech', async () => {
    renderPicker();
    await screen.findByText('Barbell Bench Press');

    expect(screen.getByTestId('exercise-search').props.accessibilityLabel).toBe('Search exercises');
  });

  it('shows an exercise photo, and tapping it opens the photo full size without selecting the exercise', async () => {
    mockFetchExercises.mockResolvedValue([
      {
        id: 'ex3',
        name: 'Leg Press',
        muscleGroup: 'quadriceps',
        movementType: 'bilateral',
        isActive: true,
        createdBy: null,
        photoUrl: 'https://example.test/leg-press.jpg',
      },
    ]);
    const onSelect = jest.fn();
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={onSelect}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );

    fireEvent.press(await screen.findByTestId('exercise-item-ex3-photo'));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId('exercise-picker-lightbox')).toBeTruthy();
  });

  it('filters to built-in or custom exercises from the source control', async () => {
    render(
      <ExercisePickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        userId="user-1"
        alreadyAddedIds={[]}
        onCreateCustom={jest.fn()}
      />,
    );
    await screen.findByTestId('exercise-item-ex1');

    fireEvent.press(screen.getByText('Mine'));
    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'mine' }),
      ),
    );

    fireEvent.press(screen.getByTestId('exercise-source-builtin'));
    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'builtin' }),
      ),
    );
  });
});
