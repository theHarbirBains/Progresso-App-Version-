import { fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { SettingsWorkoutPreferencesScreen } from './SettingsWorkoutPreferencesScreen';

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
  workoutFrequencyDays: null as number | null,
};

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: mockGoBack };

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset();
  mockGoBack.mockClear();
});

function renderScreen() {
  return render(
    <ProfileProvider>
      <SettingsWorkoutPreferencesScreen navigation={navigation} route={{} as never} />
    </ProfileProvider>,
  );
}

describe('SettingsWorkoutPreferencesScreen', () => {
  it('goes back when the header back button is pressed', async () => {
    renderScreen();
    await screen.findByTestId('open-weekly-workout-goal');

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows "Not set" when no weekly goal has ever been saved', async () => {
    renderScreen();

    expect(await screen.findByTestId('open-weekly-workout-goal')).toHaveTextContent(/Not set/);
  });

  it('shows the saved weekly goal', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, workoutFrequencyDays: 4 });
    renderScreen();

    expect(await screen.findByTestId('open-weekly-workout-goal')).toHaveTextContent(/4 days/);
  });

  it('opens a choice sheet with every onboarding-catalog option, and saves the pick', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, workoutFrequencyDays: 5 });
    renderScreen();
    await screen.findByTestId('open-weekly-workout-goal');

    fireEvent.press(screen.getByTestId('open-weekly-workout-goal'));
    expect(screen.getByTestId('weekly-workout-goal-5')).toBeTruthy();

    fireEvent.press(screen.getByTestId('weekly-workout-goal-5'));

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { workoutFrequencyDays: 5 });
    expect(await screen.findByTestId('open-weekly-workout-goal')).toHaveTextContent(/5 days/);
  });

  it('shows a save error without crashing if the save fails', async () => {
    mockUpdateMyProfile.mockRejectedValue(new Error('network down'));
    renderScreen();
    await screen.findByTestId('open-weekly-workout-goal');

    fireEvent.press(screen.getByTestId('open-weekly-workout-goal'));
    fireEvent.press(screen.getByTestId('weekly-workout-goal-3'));

    expect(await screen.findByTestId('settings-workout-preferences-error')).toHaveTextContent(
      'network down',
    );
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('open-weekly-workout-goal');
    expectNoBareText();
  });
});
