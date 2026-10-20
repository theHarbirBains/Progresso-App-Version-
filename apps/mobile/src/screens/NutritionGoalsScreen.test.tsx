import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { fonts } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { updateMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { fetchNutritionGoals, saveNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { NutritionGoalsProvider } from '../nutrition/NutritionGoalsProvider';
import { computeCalorieTargets } from '../nutrition/calorieTargets';
import { ProfileProvider, useProfile, type ProfileContextValue } from '../profile/ProfileProvider';
import { NutritionGoalsScreen } from './NutritionGoalsScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
  saveNutritionGoals: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
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
    <ProfileProvider>
      <NutritionGoalsProvider>
        <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'nutrition' }}>
          <NutritionGoalsScreen navigation={navigation} route={route} />
        </AppMenuContext.Provider>
      </NutritionGoalsProvider>
    </ProfileProvider>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset().mockImplementation(async (_token: string, updates: object) => ({
    ...baseProfile,
    ...updates,
  }));
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
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, activityLevel: null });
    renderScreen();

    await screen.findByTestId('nutrition-goals-incomplete');
    expect(screen.queryByTestId('nutrition-goals-option-maintenance')).toBeNull();
  });

  it('leaves the calorie target blank until an estimate is taken with Use -- nothing is filled in by itself', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(screen.getByTestId('nutrition-goals-calories')).toHaveProp('value', '');
    const targets = computeCalorieTargets({
      gender: 'male',
      age: 24,
      heightCm: 180,
      weightKg: 78,
      activityLevel: 'moderately_active',
    });
    fireEvent.press(screen.getByTestId('nutrition-goals-option-deficit-use'));

    expect(screen.getByTestId('nutrition-goals-calories')).toHaveProp(
      'value',
      String(targets.deficit),
    );
    expect(screen.getByTestId('nutrition-goals-estimate-note')).toHaveTextContent(
      /Mifflin-St Jeor/,
    );
  });

  it('fills the fields from the saved targets', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2400,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(screen.getByTestId('nutrition-goals-calories')).toHaveProp('value', '2400');
    expect(screen.getByTestId('nutrition-goals-protein')).toHaveProp('value', '180');
    expect(screen.getByTestId('nutrition-goals-carbs')).toHaveProp('value', '200');
    expect(screen.getByTestId('nutrition-goals-fat')).toHaveProp('value', '60');
  });

  it('does not auto-save anything just from opening the screen', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(mockSaveNutritionGoals).not.toHaveBeenCalled();
  });

  it('suggests protein and fat from body weight, and only uses them on a tap', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    // 78 kg is 172 lb: 0.7-0.8 g protein and 0.3 g fat per lb.
    expect(screen.getByTestId('nutrition-goals-macro-suggestion')).toHaveTextContent(
      /Protein 120–138 g · fat about 52 g/,
    );
    expect(screen.getByTestId('nutrition-goals-macro-suggestion')).toHaveTextContent(
      /don't make a deficit on their own/,
    );
    expect(screen.getByTestId('nutrition-goals-protein')).toHaveProp('value', '');

    fireEvent.press(screen.getByTestId('nutrition-goals-use-macros'));

    expect(screen.getByTestId('nutrition-goals-protein')).toHaveProp('value', '129');
    expect(screen.getByTestId('nutrition-goals-fat')).toHaveProp('value', '52');
  });

  it('works carbs out from the calories left after protein and fat, and keeps carbs the person typed', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '2200');
    expect(screen.getByTestId('nutrition-goals-carb-hint')).toHaveTextContent(
      'Add protein and fat to get a carb suggestion.',
    );
    fireEvent.changeText(screen.getByTestId('nutrition-goals-protein'), '160');
    fireEvent.changeText(screen.getByTestId('nutrition-goals-fat'), '60');
    expect(screen.getByTestId('nutrition-goals-carbs')).toHaveProp('value', '255');
    expect(screen.getByTestId('nutrition-goals-total')).toHaveTextContent(
      'Your macros come to 2,200 cal, matching your calorie target.',
    );

    fireEvent.changeText(screen.getByTestId('nutrition-goals-carbs'), '230');
    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '2400');
    expect(screen.getByTestId('nutrition-goals-carbs')).toHaveProp('value', '230');
    expect(screen.getByTestId('nutrition-goals-carb-hint')).toHaveTextContent(/room for 305 g/);
    expect(screen.getByTestId('nutrition-goals-total')).toHaveTextContent(
      /2,100 cal, 300 under your 2,400 cal target/,
    );

    fireEvent.press(screen.getByTestId('nutrition-goals-use-carbs'));
    expect(screen.getByTestId('nutrition-goals-carbs')).toHaveProp('value', '305');
  });

  it('explains protein and fat that pass the calorie target, rather than clamping carbs', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '1500');
    fireEvent.changeText(screen.getByTestId('nutrition-goals-protein'), '200');
    fireEvent.changeText(screen.getByTestId('nutrition-goals-fat'), '100');

    expect(screen.getByTestId('nutrition-goals-carb-hint')).toHaveTextContent(
      /Protein and fat come to 1,700 cal, 200 more than your calorie target/,
    );
    expect(screen.getByTestId('nutrition-goals-carbs')).toHaveProp('value', '');
  });

  it('says a carb suggestion needs a calorie target', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(screen.getByTestId('nutrition-goals-carb-hint')).toHaveTextContent(
      'A carb suggestion needs a calorie target.',
    );
  });

  it('rejects a non-whole calorie target and disables Save', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '2400.5');

    expect(screen.getByTestId('nutrition-goals-save').props.accessibilityState.disabled).toBe(true);
  });

  it('saves all four targets as typed, blank as no target', async () => {
    mockSaveNutritionGoals.mockImplementation(async (_user: string, goals: object) => goals);
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '2200');
    fireEvent.changeText(screen.getByTestId('nutrition-goals-protein'), '160');
    await act(async () => {
      fireEvent.press(screen.getByTestId('nutrition-goals-save'));
    });

    expect(mockSaveNutritionGoals).toHaveBeenCalledWith('user-1', {
      calories: 2200,
      proteinG: 160,
      carbsG: null,
      fatG: null,
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
    mockFetchMyProfile.mockRejectedValue(new Error('network error'));

    renderScreen();

    expect(await screen.findByTestId('nutrition-goals-error')).toHaveTextContent('network error');
  });

  it('recalculates the estimates whenever the shared profile cache updates elsewhere, never the targets', async () => {
    // Simulates CalorieEstimationScreen -- a different screen, not rendered
    // here -- saving a weight change via the same shared updateProfile.
    let capturedUpdateProfile: ProfileContextValue['updateProfile'] | undefined;
    function CaptureUpdateProfile() {
      capturedUpdateProfile = useProfile().updateProfile;
      return null;
    }
    mockFetchNutritionGoals.mockResolvedValue({ ...emptyGoals, calories: 2100 });

    render(
      <ProfileProvider>
        <NutritionGoalsProvider>
          <CaptureUpdateProfile />
          <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'nutrition' }}>
            <NutritionGoalsScreen navigation={navigation} route={route} />
          </AppMenuContext.Provider>
        </NutritionGoalsProvider>
      </ProfileProvider>,
    );
    await screen.findByTestId('nutrition-goals-scroll');
    const initialSummary = screen.getByTestId('nutrition-goals-summary').props.children;
    const initialMaintenance = screen.getByTestId('nutrition-goals-option-maintenance-value').props
      .children;

    await act(async () => {
      await capturedUpdateProfile?.({ weightValue: 95 });
    });

    expect(screen.getByTestId('nutrition-goals-summary').props.children).not.toEqual(
      initialSummary,
    );
    expect(
      screen.getByTestId('nutrition-goals-option-maintenance-value').props.children,
    ).not.toEqual(initialMaintenance);
    // A new weight changes the suggestions, never a saved target.
    expect(screen.getByTestId('nutrition-goals-calories')).toHaveProp('value', '2100');
    expect(mockSaveNutritionGoals).not.toHaveBeenCalled();
  });

  it('shows a concise Important Notes section', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(screen.getByTestId('nutrition-goals-notes')).toHaveTextContent(/estimates/i);
  });
});

describe('NutritionGoalsScreen -- rows and one labelled field, one primary action', () => {
  it('is four widgets: your information, your daily targets, the estimates and the notes', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    const cards = screen.UNSAFE_queryAllByType(AppCard);
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => Boolean(c.props.hero))).toEqual([true, false, false, false]);
    // Today's Edit Targets opens here for the targets, so they come straight after the summary.
    expect(cards.map((c) => c.props.testID)).toEqual([
      'nutrition-goals-info-card',
      'nutrition-goals-custom-card',
      'nutrition-goals-targets',
      'nutrition-goals-notes',
    ]);
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

  it('labels the target fields and offers Edit as a plain 44pt text action', async () => {
    renderScreen();
    await screen.findByTestId('nutrition-goals-scroll');

    expect(screen.getByTestId('nutrition-goals-calories').props.accessibilityLabel).toBe(
      'Calories',
    );
    expect(screen.getByTestId('nutrition-goals-protein').props.accessibilityLabel).toBe(
      'Protein (g)',
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
    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '2400');
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
