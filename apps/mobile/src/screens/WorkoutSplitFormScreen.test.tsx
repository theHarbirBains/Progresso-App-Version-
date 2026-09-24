import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { updateMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import {
  createWorkoutSplit,
  createWorkoutSplitDay,
  deleteWorkoutSplitDay,
  fetchWorkoutSplitDetail,
  renameWorkoutSplit,
  renameWorkoutSplitDay,
  reorderWorkoutSplitDays,
  setWorkoutSplitDayMuscleGroups,
} from '../workouts/workoutSplitQueries';
import { WorkoutSplitFormScreen } from './WorkoutSplitFormScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn().mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    activeWorkoutSplitId: null,
  }),
  updateMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(),
  createWorkoutSplit: jest.fn(),
  renameWorkoutSplit: jest.fn(),
  createWorkoutSplitDay: jest.fn(),
  renameWorkoutSplitDay: jest.fn(),
  deleteWorkoutSplitDay: jest.fn(),
  reorderWorkoutSplitDays: jest.fn(),
  setWorkoutSplitDayMuscleGroups: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockFetchWorkoutSplitDetail = fetchWorkoutSplitDetail as jest.Mock;
const mockCreateWorkoutSplit = createWorkoutSplit as jest.Mock;
const mockRenameWorkoutSplit = renameWorkoutSplit as jest.Mock;
const mockCreateWorkoutSplitDay = createWorkoutSplitDay as jest.Mock;
const mockRenameWorkoutSplitDay = renameWorkoutSplitDay as jest.Mock;
const mockDeleteWorkoutSplitDay = deleteWorkoutSplitDay as jest.Mock;
const mockReorderWorkoutSplitDays = reorderWorkoutSplitDays as jest.Mock;
const mockSetWorkoutSplitDayMuscleGroups = setWorkoutSplitDayMuscleGroups as jest.Mock;

const mockGoBack = jest.fn();
const mockSetParams = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, setParams: mockSetParams };

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockFetchWorkoutSplitDetail.mockReset();
  mockCreateWorkoutSplit.mockReset();
  mockRenameWorkoutSplit.mockReset().mockResolvedValue(undefined);
  mockCreateWorkoutSplitDay.mockReset();
  mockRenameWorkoutSplitDay.mockReset().mockResolvedValue(undefined);
  mockDeleteWorkoutSplitDay.mockReset().mockResolvedValue(undefined);
  mockReorderWorkoutSplitDays.mockReset().mockResolvedValue(undefined);
  mockSetWorkoutSplitDayMuscleGroups.mockReset().mockResolvedValue(undefined);
  mockUpdateMyProfile.mockReset().mockResolvedValue(undefined);
  mockGoBack.mockClear();
  mockSetParams.mockClear();
});

describe('WorkoutSplitFormScreen -- create mode (no splitId)', () => {
  const route = { params: {} } as never;

  it('shows only the name field and a Create button', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-split-form-name')).toBeTruthy();
    expect(screen.getByTestId('workout-split-form-create')).toBeTruthy();
    expect(screen.queryByTestId('workout-split-form-add-day')).toBeNull();
  });

  it('disables Create until a name is entered', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(
      (await screen.findByTestId('workout-split-form-create')).props.accessibilityState?.disabled,
    ).toBe(true);
  });

  it('creates the split and switches into edit mode via setParams', async () => {
    mockCreateWorkoutSplit.mockResolvedValue({ id: 'split-1', name: 'PPL' });

    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    fireEvent.changeText(await screen.findByTestId('workout-split-form-name'), 'PPL');
    fireEvent.press(screen.getByTestId('workout-split-form-create'));

    await waitFor(() => expect(mockCreateWorkoutSplit).toHaveBeenCalledWith('user-1', 'PPL'));
    expect(mockSetParams).toHaveBeenCalledWith({ splitId: 'split-1' });
  });

  it('does not activate the new split by default', async () => {
    mockCreateWorkoutSplit.mockResolvedValue({ id: 'split-1', name: 'PPL' });

    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    fireEvent.changeText(await screen.findByTestId('workout-split-form-name'), 'PPL');
    fireEvent.press(screen.getByTestId('workout-split-form-create'));

    await waitFor(() => expect(mockCreateWorkoutSplit).toHaveBeenCalled());
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });
});

describe('WorkoutSplitFormScreen -- create mode with activateOnCreate', () => {
  const route = { params: { activateOnCreate: true } } as never;

  it('activates the new split immediately after creating it', async () => {
    mockCreateWorkoutSplit.mockResolvedValue({ id: 'split-1', name: 'My Training' });

    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    fireEvent.changeText(await screen.findByTestId('workout-split-form-name'), 'My Training');
    fireEvent.press(screen.getByTestId('workout-split-form-create'));

    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
        activeWorkoutSplitId: 'split-1',
      }),
    );
    expect(mockSetParams).toHaveBeenCalledWith({ splitId: 'split-1' });
  });
});

describe('WorkoutSplitFormScreen -- edit mode', () => {
  const route = { params: { splitId: 'split-1' } } as never;

  beforeEach(() => {
    mockFetchWorkoutSplitDetail.mockResolvedValue({
      id: 'split-1',
      name: 'PPL - Hypertrophy',
      days: [
        { id: 'day-push', name: 'Push', orderIndex: 1, muscleGroups: ['chest'] },
        { id: 'day-pull', name: 'Pull', orderIndex: 2, muscleGroups: [] },
      ],
    });
  });

  it('loads and displays the split name and its days', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-split-form-name')).toHaveProp(
      'value',
      'PPL - Hypertrophy',
    );
    expect(screen.getByTestId('workout-split-day-day-push')).toBeTruthy();
    expect(screen.getByTestId('workout-split-day-day-pull')).toBeTruthy();
  });

  it('renames the split on blur', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-form-name');

    fireEvent.changeText(screen.getByTestId('workout-split-form-name'), 'New Name');
    fireEvent(screen.getByTestId('workout-split-form-name'), 'blur');

    await waitFor(() => expect(mockRenameWorkoutSplit).toHaveBeenCalledWith('split-1', 'New Name'));
  });

  it('adds a new day', async () => {
    mockCreateWorkoutSplitDay.mockResolvedValue({
      id: 'day-legs',
      name: 'Day 3',
      orderIndex: 3,
      muscleGroups: [],
    });

    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-form-add-day');

    fireEvent.press(screen.getByTestId('workout-split-form-add-day'));

    await waitFor(() =>
      expect(mockCreateWorkoutSplitDay).toHaveBeenCalledWith('split-1', 'Day 3', 3),
    );
    expect(await screen.findByTestId('workout-split-day-day-legs')).toBeTruthy();
  });

  it('renames a day on blur', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-name-day-push');

    fireEvent.changeText(screen.getByTestId('workout-split-day-name-day-push'), 'Upper A');
    fireEvent(screen.getByTestId('workout-split-day-name-day-push'), 'blur');

    await waitFor(() =>
      expect(mockRenameWorkoutSplitDay).toHaveBeenCalledWith('day-push', 'Upper A'),
    );
  });

  it('allows an arbitrary custom day name and never sends it as a muscle group', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-name-day-push');

    fireEvent.changeText(
      screen.getByTestId('workout-split-day-name-day-push'),
      'Shoulders and Arms',
    );
    fireEvent(screen.getByTestId('workout-split-day-name-day-push'), 'blur');

    await waitFor(() =>
      expect(mockRenameWorkoutSplitDay).toHaveBeenCalledWith('day-push', 'Shoulders and Arms'),
    );
    // Renaming a day is a completely separate call from setting its muscle
    // groups -- the day name is never translated into a split_muscle_group.
    expect(mockSetWorkoutSplitDayMuscleGroups).not.toHaveBeenCalled();
  });

  it('reverts the display to the last confirmed name when a day name is cleared to blank on blur', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-name-day-push');

    fireEvent.changeText(screen.getByTestId('workout-split-day-name-day-push'), '');
    fireEvent(screen.getByTestId('workout-split-day-name-day-push'), 'blur');

    await waitFor(() =>
      expect(screen.getByTestId('workout-split-day-name-day-push')).toHaveProp('value', 'Push'),
    );
    // A blank name is never persisted.
    expect(mockRenameWorkoutSplitDay).not.toHaveBeenCalled();
  });

  it('removes a day', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-remove-day-pull');

    fireEvent.press(screen.getByTestId('workout-split-day-remove-day-pull'));

    await waitFor(() => expect(mockDeleteWorkoutSplitDay).toHaveBeenCalledWith('day-pull'));
    expect(screen.queryByTestId('workout-split-day-day-pull')).toBeNull();
  });

  it('reorders days via the up/down buttons', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-down-day-push');

    fireEvent.press(screen.getByTestId('workout-split-day-down-day-push'));

    await waitFor(() =>
      expect(mockReorderWorkoutSplitDays).toHaveBeenCalledWith('split-1', [
        { id: 'day-pull', name: 'Pull' },
        { id: 'day-push', name: 'Push' },
      ]),
    );
  });

  it('disables moving the first day up and the last day down', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-up-day-push');

    expect(
      screen.getByTestId('workout-split-day-up-day-push').props.accessibilityState?.disabled,
    ).toBe(true);
    expect(
      screen.getByTestId('workout-split-day-down-day-pull').props.accessibilityState?.disabled,
    ).toBe(true);
  });

  it('toggles a muscle group on a day', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-day-pull-muscle-back');

    fireEvent.press(screen.getByTestId('workout-split-day-day-pull-muscle-back'));

    await waitFor(() =>
      expect(mockSetWorkoutSplitDayMuscleGroups).toHaveBeenCalledWith('day-pull', ['back']),
    );
  });

  it('persists "Shoulders" as a single general muscle group, not a day-name-derived value', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-day-push-muscle-shoulders');

    fireEvent.press(screen.getByTestId('workout-split-day-day-push-muscle-shoulders'));

    await waitFor(() =>
      expect(mockSetWorkoutSplitDayMuscleGroups).toHaveBeenCalledWith('day-push', [
        'chest',
        'shoulders',
      ]),
    );
  });

  it('keeps Biceps, Triceps, and Forearms as independently toggleable groups', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-day-pull-muscle-biceps');

    fireEvent.press(screen.getByTestId('workout-split-day-day-pull-muscle-biceps'));
    await waitFor(() =>
      expect(mockSetWorkoutSplitDayMuscleGroups).toHaveBeenLastCalledWith('day-pull', ['biceps']),
    );

    fireEvent.press(screen.getByTestId('workout-split-day-day-pull-muscle-triceps'));
    await waitFor(() =>
      expect(mockSetWorkoutSplitDayMuscleGroups).toHaveBeenLastCalledWith('day-pull', [
        'biceps',
        'triceps',
      ]),
    );

    fireEvent.press(screen.getByTestId('workout-split-day-day-pull-muscle-forearms'));
    await waitFor(() =>
      expect(mockSetWorkoutSplitDayMuscleGroups).toHaveBeenLastCalledWith('day-pull', [
        'biceps',
        'triceps',
        'forearms',
      ]),
    );
  });

  it('untoggles an already-selected muscle group', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-day-push-muscle-chest');

    fireEvent.press(screen.getByTestId('workout-split-day-day-push-muscle-chest'));

    await waitFor(() =>
      expect(mockSetWorkoutSplitDayMuscleGroups).toHaveBeenCalledWith('day-push', []),
    );
  });

  it('shows a "Done" button that goes back when this is not the activateOnCreate flow', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-form-done');

    expect(screen.getByTestId('workout-split-form-done')).toHaveTextContent('Done');
    fireEvent.press(screen.getByTestId('workout-split-form-done'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('goes back when Back is pressed', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-form-back');

    fireEvent.press(screen.getByTestId('workout-split-form-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a load error without crashing', async () => {
    mockFetchWorkoutSplitDetail.mockRejectedValue(new Error('network down'));

    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-split-form-error')).toHaveTextContent('network down');
  });
});

describe('WorkoutSplitFormScreen -- edit mode reached via activateOnCreate', () => {
  const route = { params: { splitId: 'split-1', activateOnCreate: true } } as never;

  it('labels the finishing button "Create Split" instead of "Done"', async () => {
    mockFetchWorkoutSplitDetail.mockResolvedValue({
      id: 'split-1',
      name: 'My Training',
      days: [{ id: 'day-push', name: 'Push', orderIndex: 1, muscleGroups: [] }],
    });

    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-split-form-done')).toHaveTextContent('Create Split');
    fireEvent.press(screen.getByTestId('workout-split-form-done'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});

describe('WorkoutSplitFormScreen -- shared controls, days as blocks', () => {
  const route = { params: { splitId: 'split-1' } } as never;

  beforeEach(() => {
    mockFetchWorkoutSplitDetail.mockResolvedValue({
      id: 'split-1',
      name: 'PPL - Hypertrophy',
      days: [
        { id: 'day-push', name: 'Push', orderIndex: 1, muscleGroups: ['chest'] },
        { id: 'day-pull', name: 'Pull', orderIndex: 2, muscleGroups: [] },
      ],
    });
  });

  it('shows days as hairline-separated blocks in no cards', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    const first = await screen.findByTestId('workout-split-day-day-push');
    const second = screen.getByTestId('workout-split-day-day-pull');

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(0);
    expect(StyleSheet.flatten(first.props.style).borderTopWidth).toBeUndefined();
    expect(StyleSheet.flatten(second.props.style).borderTopWidth).toBe(StyleSheet.hairlineWidth);
  });

  it('uses labelled shared inputs for the split and each day', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect((await screen.findByTestId('workout-split-form-name')).props.accessibilityLabel).toBe(
      'Split Name',
    );
    expect(screen.getByTestId('workout-split-day-name-day-push').props.accessibilityLabel).toBe(
      'Day 1 name',
    );
    expect(screen.getByText('Split Name')).toBeTruthy();
  });

  it('names the reorder/remove controls for assistive tech, and gives each a 44pt touch area', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('workout-split-day-day-push');

    for (const [id, label] of [
      ['workout-split-day-up-day-pull', 'Move day up'],
      ['workout-split-day-down-day-push', 'Move day down'],
      ['workout-split-day-remove-day-push', 'Remove day'],
    ] as const) {
      const control = screen.getByTestId(id);
      expect(control.props.accessibilityLabel).toBe(label);
      const style = StyleSheet.flatten(control.props.style);
      const slop = control.props.hitSlop as { top: number; bottom: number };
      expect(style.height + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
    }
  });

  it('shows a selected muscle chip filled in the mode accent, an unselected one neutral', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    const on = await screen.findByTestId('workout-split-day-day-push-muscle-chest');
    const off = screen.getByTestId('workout-split-day-day-push-muscle-back');

    expect(StyleSheet.flatten(on.props.style).backgroundColor).toBe(DEFAULT_WORKOUT_THEME.accent);
    expect(on.props.accessibilityState.selected).toBe(true);
    expect(StyleSheet.flatten(off.props.style).backgroundColor).not.toBe(
      DEFAULT_WORKOUT_THEME.accent,
    );
    expect(off.props.accessibilityState.selected).toBe(false);
  });

  it('keeps each chip a comfortable target: 36pt visible plus a hit area that reaches 44pt', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    const chip = await screen.findByTestId('workout-split-day-day-push-muscle-chest');

    const style = StyleSheet.flatten(chip.props.style);
    const slop = chip.props.hitSlop as { top: number; bottom: number };
    expect(style.minHeight + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
  });

  it('has one clear primary action -- Done -- with Add Workout Day as the quiet secondary', async () => {
    render(<WorkoutSplitFormScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    const done = await screen.findByTestId('workout-split-form-done');
    const add = screen.getByTestId('workout-split-form-add-day');

    expect(StyleSheet.flatten(done.props.style).backgroundColor).toBe(DEFAULT_WORKOUT_THEME.accent);
    const addStyle = StyleSheet.flatten(add.props.style);
    expect(addStyle.backgroundColor).toBeUndefined();
    expect(addStyle.borderStyle).toBeUndefined();
    expect(within(add).getByText('+ Add Workout Day')).toBeTruthy();
  });

  it('shows the busy state on the Create button while a new split is created', async () => {
    mockCreateWorkoutSplit.mockReturnValue(new Promise(() => undefined));
    const createRoute = { params: {} } as never;
    render(<WorkoutSplitFormScreen navigation={navigation} route={createRoute} />, {
      wrapper: ProfileProvider,
    });

    fireEvent.changeText(await screen.findByTestId('workout-split-form-name'), 'My Split');
    fireEvent.press(screen.getByTestId('workout-split-form-create'));

    await waitFor(() =>
      expect(screen.getByTestId('workout-split-form-create').props.accessibilityState).toEqual({
        disabled: true,
        busy: true,
      }),
    );
  });
});
