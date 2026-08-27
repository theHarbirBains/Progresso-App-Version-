import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { AccountSettingsScreen } from './AccountSettingsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;

const baseProfile = {
  id: 'user-1',
  email: 'athlete@example.com',
  role: 'user',
  displayName: 'Athlete',
  username: 'athlete1',
  weightUnit: 'kg' as const,
};

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation = { navigate: mockNavigate } as any;

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'athlete@example.com' },
    session: { access_token: 'token-123' },
    signOut: jest.fn(),
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset();
  mockNavigate.mockClear();
});

describe('AccountSettingsScreen', () => {
  it('loads and displays the profile', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('account-email')).toHaveTextContent('athlete@example.com');
    expect(screen.getByTestId('account-display-name').props.value).toBe('Athlete');
    expect(screen.getByTestId('account-username').props.value).toBe('athlete1');
    expect(mockGetMyProfile).toHaveBeenCalledWith('token-123');
  });

  it('shows a load error when the profile fetch fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('Failed to load profile'));

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('account-load-error')).toHaveTextContent(
      'Failed to load profile',
    );
  });

  it('lowercases username input as the user types', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.changeText(screen.getByTestId('account-username'), 'NewHandle');

    expect(screen.getByTestId('account-username').props.value).toBe('newhandle');
  });

  it('saves the profile and shows a confirmation', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, displayName: 'New Name' });

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.changeText(screen.getByTestId('account-display-name'), 'New Name');
    fireEvent.press(screen.getByTestId('account-unit-lb'));
    fireEvent.press(screen.getByTestId('account-save'));

    expect(await screen.findByTestId('account-saved')).toBeTruthy();
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      displayName: 'New Name',
      username: 'athlete1',
      weightUnit: 'lb',
    });
  });

  it('shows a save error and does not show the saved confirmation on failure', async () => {
    mockUpdateMyProfile.mockRejectedValue(new Error('Username is already taken'));

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.press(screen.getByTestId('account-save'));

    expect(await screen.findByTestId('account-save-error')).toHaveTextContent(
      'Username is already taken',
    );
    expect(screen.queryByTestId('account-saved')).toBeNull();
  });

  it('navigates to the Exercise Library when its button is pressed', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.press(screen.getByTestId('open-exercise-library'));

    expect(mockNavigate).toHaveBeenCalledWith('ExerciseLibrary');
  });

  it('navigates to Workouts when its button is pressed', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.press(screen.getByTestId('open-workouts'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutHistory');
  });

  it('navigates to Nutrition when its button is pressed', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.press(screen.getByTestId('open-nutrition'));

    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('calls signOut when the sign-out button is pressed', async () => {
    const signOut = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'athlete@example.com' },
      session: { access_token: 'token-123' },
      signOut,
    });

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.press(screen.getByTestId('sign-out-button'));

    expect(signOut).toHaveBeenCalled();
  });
});
