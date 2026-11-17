import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { useProfile } from '../profile/ProfileProvider';
import { useAvatarPhoto } from '../profile/useAvatarPhoto';
import { WelcomeScreen } from './WelcomeScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../profile/ProfileProvider', () => ({ useProfile: jest.fn() }));
jest.mock('../nutrition/NutritionGoalsProvider', () => ({ useNutritionGoals: jest.fn() }));
jest.mock('../profile/useAvatarPhoto', () => ({ useAvatarPhoto: jest.fn() }));
const mockRefetchAllTimeStats = jest.fn(async () => true);
jest.mock('../progress/AllTimeStatsProvider', () => ({
  useAllTimeStats: () => ({ refetch: mockRefetchAllTimeStats }),
}));
const mockInvalidateExerciseCache = jest.fn();
jest.mock('../exercises/exerciseQueries', () => ({
  invalidateExerciseCache: (userId: string) => mockInvalidateExerciseCache(userId),
}));
// The contacts part has its own tests (FindPeopleScreen's Suggested).
jest.mock('../social/ContactSuggestions', () => {
  const { Text } = jest.requireActual('react-native');
  return { ContactSuggestions: () => <Text testID="contact-suggestions">Contacts</Text> };
});

const refetchProfile = jest.fn();
const refetchGoals = jest.fn();
const choosePhoto = jest.fn();
let avatarUrl: string | null = null;

beforeEach(() => {
  avatarUrl = null;
  refetchProfile.mockReset().mockResolvedValue(true);
  refetchGoals.mockReset().mockResolvedValue(true);
  choosePhoto.mockReset().mockResolvedValue(undefined);
  jest.mocked(useAuth).mockReturnValue({ user: { id: 'user-1' } } as never);
  jest.mocked(useProfile).mockImplementation(
    () =>
      ({
        profile: { displayName: 'Harbir', username: 'harbir', avatarUrl },
        refetch: refetchProfile,
      }) as never,
  );
  jest.mocked(useNutritionGoals).mockReturnValue({ refetch: refetchGoals } as never);
  jest
    .mocked(useAvatarPhoto)
    .mockImplementation(() => ({ choosePhoto, saving: false, error: null }) as never);
});

describe('WelcomeScreen', () => {
  it('reads the profile, daily targets and history again, so the app opens on what onboarding saved', async () => {
    mockRefetchAllTimeStats.mockClear();
    mockInvalidateExerciseCache.mockClear();
    render(<WelcomeScreen onDone={jest.fn()} />);
    await act(async () => {});

    expect(refetchProfile).toHaveBeenCalledTimes(1);
    expect(refetchGoals).toHaveBeenCalledTimes(1);
    // A trainer's history claimed with their code moved after the account's first, empty read.
    expect(mockRefetchAllTimeStats).toHaveBeenCalledTimes(1);
    expect(mockInvalidateExerciseCache).toHaveBeenCalledWith('user-1');
  });

  it('offers a profile photo first, which can wait', async () => {
    const onDone = jest.fn();
    render(<WelcomeScreen onDone={onDone} />);

    expect(screen.getByTestId('welcome-photo')).toBeTruthy();
    fireEvent.press(screen.getByTestId('welcome-photo-choose'));
    expect(choosePhoto).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('welcome-photo-skip'));
    expect(screen.getByTestId('welcome-friends')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('moves on with Continue once a photo is chosen', () => {
    avatarUrl = 'https://example.test/me.jpg';
    render(<WelcomeScreen onDone={jest.fn()} />);

    expect(screen.queryByTestId('welcome-photo-skip')).toBeNull();
    fireEvent.press(screen.getByTestId('welcome-photo-continue'));
    expect(screen.getByTestId('welcome-friends')).toBeTruthy();
  });

  it('then the people in their contacts on Progresso, and Done opens the app', () => {
    const onDone = jest.fn();
    render(<WelcomeScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId('welcome-photo-skip'));

    expect(screen.getByTestId('contact-suggestions')).toBeTruthy();
    fireEvent.press(screen.getByTestId('welcome-done'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
