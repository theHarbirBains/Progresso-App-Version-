import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { fetchExerciseSettings } from '../workouts/exerciseSettingsQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { updateMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { SettingsWorkoutPreferencesScreen } from './SettingsWorkoutPreferencesScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../workouts/exerciseSettingsQueries', () => ({
  fetchExerciseSettings: jest.fn().mockResolvedValue(new Map()),
  clearExerciseSetting: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;

const baseProfile = {
  id: 'user-1',
  email: 'athlete@example.com',
  role: 'user',
  displayName: 'Athlete',
  username: 'athlete1',
  weightUnit: 'kg' as const,
  workoutFrequencyDays: null as number | null,
  trainingComfort: null as string | null,
  repRangeMin: 8,
  repRangeMax: 12,
  progressionCuesEnabled: true,
};

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: mockGoBack };

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' }, user: { id: 'user-1' } });
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
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
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, workoutFrequencyDays: 4 });
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

  it('shows the comfort answer, the rep range and the suggestions switch', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, trainingComfort: 'knows_basics' });
    renderScreen();

    expect(await screen.findByTestId('open-training-comfort')).toHaveTextContent(
      /I understand the basics/,
    );
    expect(screen.getByTestId('open-rep-range')).toHaveTextContent(/8–12/);
    expect(screen.getByTestId('progression-tips-toggle').props.value).toBe(true);
  });

  it('says the comfort answer is not set for an account made before the question', async () => {
    renderScreen();
    expect(await screen.findByTestId('open-training-comfort')).toHaveTextContent(/Not set/);
  });

  it('saves a new comfort answer without touching the range', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, trainingComfort: 'follows_method' });
    renderScreen();
    fireEvent.press(await screen.findByTestId('open-training-comfort'));

    fireEvent.press(screen.getByTestId('training-comfort-follows_method'));

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      trainingComfort: 'follows_method',
    });
    expect(await screen.findByTestId('open-training-comfort')).toHaveTextContent(
      /I follow structured programming/,
    );
  });

  it('saves any rep range whose bottom is below its top', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, repRangeMin: 10, repRangeMax: 15 });
    renderScreen();
    fireEvent.press(await screen.findByTestId('open-rep-range'));

    fireEvent.press(screen.getByTestId('rep-range-min-item-10'));
    fireEvent.press(screen.getByTestId('rep-range-max-item-15'));
    expect(screen.getByTestId('rep-range-save')).toHaveTextContent('Save 10–15');
    fireEvent.press(screen.getByTestId('rep-range-save'));

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      repRangeMin: 10,
      repRangeMax: 15,
    });
    expect(await screen.findByTestId('open-rep-range')).toHaveTextContent(/10–15/);
  });

  it('saves a range of one number, such as 12', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, repRangeMin: 12, repRangeMax: 12 });
    renderScreen();
    fireEvent.press(await screen.findByTestId('open-rep-range'));

    fireEvent.press(screen.getByTestId('rep-range-min-item-12'));

    expect(screen.queryByTestId('rep-range-error')).toBeNull();
    expect(screen.getByTestId('rep-range-save')).toHaveTextContent('Save 12');
  });

  it("won't save a range whose bottom is above its top", async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('open-rep-range'));

    fireEvent.press(screen.getByTestId('rep-range-min-item-13'));

    expect(screen.getByTestId('rep-range-error')).toHaveTextContent(/can't be above the top/);
    expect(screen.getByTestId('rep-range-save').props.accessibilityState.disabled).toBe(true);
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it('turns the suggestions off', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, progressionCuesEnabled: false });
    renderScreen();
    await screen.findByTestId('progression-tips-toggle');

    fireEvent(screen.getByTestId('progression-tips-toggle'), 'valueChange', false);

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      progressionCuesEnabled: false,
    });
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('open-weekly-workout-goal');
    expectNoBareText();
  });
});

describe('SettingsWorkoutPreferencesScreen -- exercise ranges', () => {
  beforeEach(() => {
    (fetchExerciseSettings as jest.Mock).mockReset().mockResolvedValue(
      new Map([
        [
          'ex-1',
          {
            exerciseId: 'ex-1',
            exerciseName: 'Deadlift',
            range: { min: 3, max: 5 },
            incrementKg: null,
          },
        ],
      ]),
    );
  });

  it('counts the rep range exceptions, and opens their own page', async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('open-exercise-ranges')).toHaveTextContent(/1/));
    expect(screen.getByTestId('open-exercise-ranges')).toHaveTextContent(/Rep Range Exceptions/);
    fireEvent.press(screen.getByTestId('open-exercise-ranges'));
    expect(navigation.navigate).toHaveBeenCalledWith('RepRangeExceptions');
  });
});

describe('SettingsWorkoutPreferencesScreen -- program recommendations', () => {
  it('says each is not set until answered', async () => {
    renderScreen();

    expect(await screen.findByTestId('open-training-priorities')).toHaveTextContent(/Not set/);
    expect(screen.getByTestId('open-equipment-access')).toHaveTextContent(/Not set/);
    expect(screen.getByTestId('open-training-exclusions')).toHaveTextContent(/Nothing/);
  });

  it('picks up to three priorities and saves them, taking a priority off what is left out', async () => {
    mockFetchMyProfile.mockResolvedValue({
      ...baseProfile,
      trainingPriorities: ['back'],
      equipmentAccess: null,
      trainingExclusions: ['glutes'],
    });
    mockUpdateMyProfile.mockResolvedValue({
      ...baseProfile,
      trainingPriorities: ['back', 'glutes'],
      trainingExclusions: [],
    });
    renderScreen();
    expect(await screen.findByTestId('open-training-priorities')).toHaveTextContent(/Back/);

    fireEvent.press(screen.getByTestId('open-training-priorities'));
    fireEvent.press(screen.getByTestId('training-priority-glutes'));
    fireEvent.press(screen.getByTestId('training-priorities-save'));

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      trainingPriorities: ['back', 'glutes'],
      trainingExclusions: [],
    });
    expect(await screen.findByTestId('open-training-priorities')).toHaveTextContent(/Back, Glutes/);
  });

  it('saves where they train from its sheet', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, equipmentAccess: 'dumbbells' });
    renderScreen();
    fireEvent.press(await screen.findByTestId('open-equipment-access'));
    fireEvent.press(screen.getByTestId('equipment-access-dumbbells'));

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { equipmentAccess: 'dumbbells' });
    expect(await screen.findByTestId('open-equipment-access')).toHaveTextContent(/Dumbbells Only/);
  });

  it('saves what they have at home, with No Equipment an answer of its own', async () => {
    mockUpdateMyProfile.mockResolvedValue({
      ...baseProfile,
      homeEquipment: ['adjustable_dumbbells', 'bench'],
    });
    renderScreen();
    expect(await screen.findByTestId('open-home-equipment')).toHaveTextContent(/Not set/);

    fireEvent.press(screen.getByTestId('open-home-equipment'));
    fireEvent.press(screen.getByTestId('home-equipment-bodyweight'));
    fireEvent.press(screen.getByTestId('home-equipment-adjustable_dumbbells'));
    fireEvent.press(screen.getByTestId('home-equipment-bench'));
    fireEvent.press(screen.getByTestId('home-equipment-save'));

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      homeEquipment: ['adjustable_dumbbells', 'bench'],
    });
    expect(await screen.findByTestId('open-home-equipment')).toHaveTextContent(
      /Adjustable Dumbbells, Bench/,
    );
  });

  it('leaves out an area, but never one they prioritize', async () => {
    mockFetchMyProfile.mockResolvedValue({
      ...baseProfile,
      trainingPriorities: ['glutes'],
      trainingExclusions: [],
    });
    mockUpdateMyProfile.mockResolvedValue({
      ...baseProfile,
      trainingPriorities: ['glutes'],
      trainingExclusions: ['chest'],
    });
    renderScreen();
    fireEvent.press(await screen.findByTestId('open-training-exclusions'));

    expect(screen.getByTestId('training-exclusion-glutes')).toBeDisabled();
    fireEvent.press(screen.getByTestId('training-exclusion-chest'));
    fireEvent.press(screen.getByTestId('training-exclusions-save'));

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      trainingExclusions: ['chest'],
    });
    await waitFor(() =>
      expect(screen.getByTestId('open-training-exclusions')).toHaveTextContent(/No Direct Chest/),
    );
  });
});
