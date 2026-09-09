import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import {
  deleteWorkoutSplit,
  duplicateWorkoutSplit,
  fetchWorkoutSplits,
} from '../workouts/workoutSplitQueries';
import { WorkoutSplitsScreen } from './WorkoutSplitsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplits: jest.fn(),
  duplicateWorkoutSplit: jest.fn(),
  deleteWorkoutSplit: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockFetchWorkoutSplits = fetchWorkoutSplits as jest.Mock;
const mockDuplicateWorkoutSplit = duplicateWorkoutSplit as jest.Mock;
const mockDeleteWorkoutSplit = deleteWorkoutSplit as jest.Mock;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

const baseProfile = {
  id: 'user-1',
  email: 'a@example.com',
  role: 'user',
  displayName: null,
  username: null,
  weightUnit: 'kg' as const,
  workoutAccentColor: null,
  nutritionAccentColor: null,
  activeWorkoutSplitId: 'split-1',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockFetchWorkoutSplits.mockReset().mockResolvedValue([
    { id: 'split-1', name: 'PPL - Hypertrophy' },
    { id: 'split-2', name: 'Upper/Lower' },
  ]);
  mockDuplicateWorkoutSplit.mockReset().mockResolvedValue({ id: 'split-3', name: 'Copy' });
  mockDeleteWorkoutSplit.mockReset().mockResolvedValue(undefined);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

describe('WorkoutSplitsScreen', () => {
  it('shows the empty state with no splits', async () => {
    mockFetchWorkoutSplits.mockResolvedValue([]);

    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('workout-splits-empty')).toHaveTextContent(
      'Create a split to plan your training days.',
    );
  });

  it('lists every split and marks the active one', async () => {
    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('workout-split-split-1')).toHaveTextContent(/ACTIVE/);
    expect(screen.getByTestId('workout-split-split-2')).not.toHaveTextContent(/ACTIVE/);
  });

  it('navigates to the edit form when Edit is pressed', async () => {
    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('workout-split-edit-split-2'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitForm', { splitId: 'split-2' });
  });

  it('navigates to the read-only view when the split card is tapped', async () => {
    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('workout-split-view-split-2'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitView', { splitId: 'split-2' });
  });

  it('navigates to the create form when Create Workout Split is pressed', async () => {
    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('workout-splits-create'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitForm', {});
  });

  it('asks for confirmation before switching the active split, and applies it on confirm', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      buttons?.find((b) => b.text === 'Make Active')?.onPress?.();
    });

    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('workout-split-activate-split-2'));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      activeWorkoutSplitId: 'split-2',
    });
    expect(await screen.findByTestId('workout-split-split-2')).toHaveTextContent(/ACTIVE/);
    alertSpy.mockRestore();
  });

  it('shows an explicit "Set Active" control only for inactive splits, never the already-active one', async () => {
    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);
    await screen.findByTestId('workout-split-split-1');

    expect(screen.queryByTestId('workout-split-activate-split-1')).toBeNull();
    expect(screen.getByTestId('workout-split-activate-split-2')).toBeTruthy();
  });

  it('duplicates a split and reloads the list', async () => {
    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('workout-split-duplicate-split-2'));

    expect(mockDuplicateWorkoutSplit).toHaveBeenCalledWith('user-1', 'split-2');
    await waitFor(() => expect(mockFetchWorkoutSplits).toHaveBeenCalledTimes(2));
  });

  it('asks for confirmation before deleting, and deletes on confirm', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('workout-split-delete-split-2'));

    expect(mockDeleteWorkoutSplit).toHaveBeenCalledWith('split-2');
    await waitFor(() => expect(mockFetchWorkoutSplits).toHaveBeenCalledTimes(2));
    alertSpy.mockRestore();
  });

  it('goes back when Back is pressed', async () => {
    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('workout-splits-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a load error without crashing', async () => {
    mockFetchWorkoutSplits.mockRejectedValue(new Error('network down'));

    render(<WorkoutSplitsScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('workout-splits-error')).toHaveTextContent('network down');
  });
});
