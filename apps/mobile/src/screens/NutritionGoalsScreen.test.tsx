import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { fonts } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { fetchNutritionGoals, saveNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { computeCalorieTargets } from '../nutrition/calorieTargets';
import { NutritionGoalsScreen } from './NutritionGoalsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
  saveNutritionGoals: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchNutritionGoals = fetchNutritionGoals as jest.Mock;
const mockSaveNutritionGoals = saveNutritionGoals as jest.Mock;

const mockNavigate = jest.fn();
const mockAddListener = jest.fn(() => () => {});
const mockOpenMenu = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, addListener: mockAddListener };
const route = {} as never;

const baseProfile = {
  id: 'user-1',
  email: 'a@example.com',
  role: 'user',
  displayName: null,
  username: null,
  weightUnit: 'lb' as const,
  workoutAccentColor: null,
  nutritionAccentColor: null,
  backgroundTheme: null,
  avatarUrl: null,
  activeWorkoutSplitId: null,
  gender: 'male' as const,
  birthday: '2002-01-01',
  weightValue: 78,
  heightValue: 180,
  heightUnit: 'cm' as const,
  fitnessGoal: null,
  trainingExperience: null,
  workoutFrequencyDays: null,
  trainingStylePreference: null,
  emailOptIn: null,
  pushNotificationsOptIn: null,
  appleHealthPreference: null,
  onboardingCompletedAt: '2020-01-01T00:00:00.000Z',
  activityLevel: 'moderately_active' as const,
};

const emptyGoals = { calories: null, proteinG: null, carbsG: null, fatG: null };

function renderScreen() {
  return render(
    <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'nutrition' }}>
      <NutritionGoalsScreen navigation={navigation} route={route} />
    </AppMenuContext.Provider>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockFetchNutritionGoals.mockReset().mockResolvedValue(emptyGoals);
  mockSaveNutritionGoals.mockReset();
  mockNavigate.mockClear();
  mockAddListener.mockClear();
});

describe('NutritionGoalsScreen', () => {
  it('shows a loading indicator while fetching', async () => {
    renderScreen();

    expect(screen.getByTestId('nutrition-goals-loading')).toBeTruthy();

    await screen.findByTestId('nutrition-goals-scroll');
  });

  it('shows a real, profile-derived summary and activity level -- never hardcoded', async () => {
    renderScreen();

    const summary = await screen.findByTestId('nutrition-goals-summary');
    expect(summary).toHaveTextContent(/Male/);
    expect(summary).toHaveTextContent(/24 years/);
    expect(summary).toHaveTextContent(/180 cm/);
    expect(screen.getByText('Moderately active')).toBeTruthy();
  });

  it('navigates to CalorieEstimation when Edit is pressed', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    fireEvent.press(screen.getByTestId('nutrition-goals-edit'));

    expect(mockNavigate).toHaveBeenCalledWith('CalorieEstimation');
  });

  it('shows the four real calculated calorie options, computed from the Mifflin-St Jeor formula', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    const targets = computeCalorieTargets({
      gender: 'male',
      age: 24,
      heightCm: 180,
      weightKg: 78,
      activityLevel: 'moderately_active',
    });

    expect(screen.getByTestId('nutrition-goals-option-maintenance-value')).toHaveTextContent(
      targets.maintenance.toLocaleString(),
    );
    expect(screen.getByTestId('nutrition-goals-option-surplus-value')).toHaveTextContent(
      targets.surplus.toLocaleString(),
    );
    expect(screen.getByTestId('nutrition-goals-option-deficit-value')).toHaveTextContent(
      targets.deficit.toLocaleString(),
    );
    expect(screen.getByTestId('nutrition-goals-option-aggressive-value')).toHaveTextContent(
      targets.aggressiveDeficit.toLocaleString(),
    );
  });

  it('the four option cards are not pressable/selectable -- no navigation on press', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    fireEvent.press(screen.getByTestId('nutrition-goals-option-maintenance'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a "complete your information" state instead of fake targets when the profile is incomplete', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activityLevel: null });
    renderScreen();

    await screen.findByTestId('nutrition-goals-incomplete');
    expect(screen.queryByTestId('nutrition-goals-option-maintenance')).toBeNull();
  });

  it('prefills the custom target from the calculated maintenance value when nothing has been saved yet', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    const targets = computeCalorieTargets({
      gender: 'male',
      age: 24,
      heightCm: 180,
      weightKg: 78,
      activityLevel: 'moderately_active',
    });
    expect(screen.getByTestId('nutrition-goals-custom-input')).toHaveProp(
      'value',
      String(targets.maintenance),
    );
  });

  it('prefills the custom target from the existing saved target, never silently overwriting it', async () => {
    mockFetchNutritionGoals.mockResolvedValue({ ...emptyGoals, calories: 2400 });
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(screen.getByTestId('nutrition-goals-custom-input')).toHaveProp('value', '2400');
  });

  it('does not auto-save anything just from opening the screen', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(mockSaveNutritionGoals).not.toHaveBeenCalled();
  });

  it('shows a dynamic Save button label matching the entered custom target', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    fireEvent.changeText(screen.getByTestId('nutrition-goals-custom-input'), '2400');

    expect(screen.getByTestId('nutrition-goals-save')).toHaveTextContent(/Save 2,400 Calories/);
  });

  it('rejects a non-whole-number custom target and disables Save', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    fireEvent.changeText(screen.getByTestId('nutrition-goals-custom-input'), '2400.5');

    expect(screen.getByTestId('nutrition-goals-save').props.accessibilityState.disabled).toBe(true);
  });

  it('saves the entered custom target as the daily target, preserving existing macro goals', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: null,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });
    mockSaveNutritionGoals.mockResolvedValue({
      calories: 2400,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    fireEvent.changeText(screen.getByTestId('nutrition-goals-custom-input'), '2400');
    await act(async () => {
      fireEvent.press(screen.getByTestId('nutrition-goals-save'));
    });

    expect(mockSaveNutritionGoals).toHaveBeenCalledWith('user-1', {
      calories: 2400,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });
    expect(screen.getByTestId('nutrition-goals-saved')).toBeTruthy();
  });

  it('shows an error message when saving fails', async () => {
    mockFetchNutritionGoals.mockResolvedValue({ ...emptyGoals, calories: 2000 });
    mockSaveNutritionGoals.mockRejectedValue(new Error('network error'));
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    await act(async () => {
      fireEvent.press(screen.getByTestId('nutrition-goals-save'));
    });

    expect(screen.getByTestId('nutrition-goals-error')).toHaveTextContent('network error');
  });

  it('shows an error message when loading fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('network error'));

    renderScreen();

    expect(await screen.findByTestId('nutrition-goals-error')).toHaveTextContent('network error');
  });

  it('re-fetches and recalculates whenever the screen regains focus', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(mockAddListener).toHaveBeenCalledWith('focus', expect.any(Function));
  });

  it('shows a concise Important Notes section', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(screen.getByTestId('nutrition-goals-notes')).toHaveTextContent(/estimates/i);
  });
});

describe('NutritionGoalsScreen -- rows and one labelled field, one primary action', () => {
  it('is four widgets: your information, the estimates, the custom target and the notes', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    const cards = screen.UNSAFE_queryAllByType(AppCard);
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => Boolean(c.props.hero))).toEqual([true, false, false, false]);
  });

  it('shows the four estimates as rows with the calories as a mono readout, separated by hairlines', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    const value = StyleSheet.flatten(
      screen.getByTestId('nutrition-goals-option-maintenance-value').props.style,
    );
    expect(value.fontFamily).toBe(fonts.mono);
    expect(screen.getByTestId('nutrition-goals-option-maintenance')).toHaveTextContent(
      /Holds your current weight/,
    );
    expect(screen.getByTestId('nutrition-goals-option-deficit')).toHaveTextContent(
      /vs\. maintenance/,
    );
    const first = StyleSheet.flatten(
      screen.getByTestId('nutrition-goals-option-surplus').props.style,
    );
    const second = StyleSheet.flatten(
      screen.getByTestId('nutrition-goals-option-maintenance').props.style,
    );
    expect(first.borderTopWidth).toBeUndefined();
    expect(second.borderTopWidth).toBe(StyleSheet.hairlineWidth);
  });

  it('labels the custom target field and offers Edit as a plain 44pt text action', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(screen.getByTestId('nutrition-goals-custom-input').props.accessibilityLabel).toBe(
      'Daily calorie target',
    );
    const edit = screen.getByTestId('nutrition-goals-edit');
    expect(StyleSheet.flatten(edit.props.style).borderWidth).toBeUndefined();
    expect(StyleSheet.flatten(edit.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('has one filled Save that reports busy while saving', async () => {
    mockSaveNutritionGoals.mockReturnValue(new Promise(() => undefined));
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    fireEvent.changeText(screen.getByTestId('nutrition-goals-custom-input'), '2400');
    await act(async () => {
      fireEvent.press(screen.getByTestId('nutrition-goals-save'));
    });

    expect(screen.getByTestId('nutrition-goals-save').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expectNoBareText();
  });
});
