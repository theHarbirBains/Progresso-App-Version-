import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { SocialScreen } from './SocialScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue({
    id: 'user-1',
    email: 'athlete@example.com',
    role: 'user',
    displayName: 'Harbir',
    username: 'harbir_b',
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    activeWorkoutSplitId: null,
  });
  mockNavigate.mockClear();
});

describe('SocialScreen', () => {
  it('shows the tagline and the profile name/username', async () => {
    render(<SocialScreen navigation={navigation} route={route} />);

    expect(await screen.findByText('Train together. Progress together.')).toBeTruthy();
    expect(screen.getByText('Harbir')).toBeTruthy();
    expect(screen.getByText('@harbir_b')).toBeTruthy();
  });

  it('shows an error message, without crashing, when the profile request fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('User profile not found'));

    render(<SocialScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('social-profile-error')).toHaveTextContent(
      'User profile not found',
    );
    expect(screen.getByTestId('social-bottom-bar')).toBeTruthy();
  });

  it('navigates to AccountSettings when View Profile is pressed', async () => {
    render(<SocialScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('social-view-profile'));

    expect(mockNavigate).toHaveBeenCalledWith('AccountSettings');
  });

  it('shows an honest empty state for Recent Activity, never fake posts', async () => {
    render(<SocialScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('social-activity-empty')).toHaveTextContent(
      'Your fitness story starts here.',
    );
  });

  it('renders the shared bottom bar with Social active', async () => {
    render(<SocialScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('social-bottom-bar')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-social').props.accessibilityState.selected).toBe(true);
  });

  it('opens the quick action menu from the bottom bar', async () => {
    render(<SocialScreen navigation={navigation} route={route} />);
    await screen.findByTestId('social-bottom-bar');

    fireEvent.press(screen.getByTestId('bottom-nav-plus'));

    expect(screen.getByTestId('quick-action-start-workout')).toBeTruthy();
  });

  it('navigates to NewWorkout from the quick action menu', async () => {
    render(<SocialScreen navigation={navigation} route={route} />);
    await screen.findByTestId('social-bottom-bar');
    fireEvent.press(screen.getByTestId('bottom-nav-plus'));

    fireEvent.press(screen.getByTestId('quick-action-start-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
  });

  it('navigates to Dashboard when Home is pressed', async () => {
    render(<SocialScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('bottom-nav-home'));

    expect(mockNavigate).toHaveBeenCalledWith('Dashboard');
  });
});
