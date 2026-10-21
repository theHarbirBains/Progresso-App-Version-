import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, TextInput as RNTextInput } from 'react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { fonts } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { updateMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { fetchNutritionGoals, saveNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { NutritionGoalsProvider } from '../nutrition/NutritionGoalsProvider';
import { PhaseProvider } from '../phases/PhaseProvider';
import { fetchPhases } from '../phases/phaseQueries';
import { computeCalorieTargets } from '../nutrition/calorieTargets';
import { ProfileProvider, useProfile, type ProfileContextValue } from '../profile/ProfileProvider';
import { NutritionGoalsScreen } from './NutritionGoalsScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../phases/phaseQueries', () => ({
  fetchPhases: jest.fn().mockResolvedValue([]),
}));

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
        <PhaseProvider>
          <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'nutrition' }}>
            <NutritionGoalsScreen navigation={navigation} route={route} />
          </AppMenuContext.Provider>
        </PhaseProvider>
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

const estimates = computeCalorieTargets({
  gender: 'male',
  age: 24,
  heightCm: 180,
  weightKg: 78,
  activityLevel: 'moderately_active',
});

async function opened() {
  renderScreen();
  await screen.findByTestId('nutrition-goals-scroll');
}

describe('NutritionGoalsScreen', () => {
  it('shows a loading indicator while fetching', async () => {
    renderScreen();

    expect(screen.getByTestId('nutrition-goals-loading')).toBeTruthy();

    await screen.findByTestId('nutrition-goals-scroll');
  });

  it("shows the person's own details and activity level as tiles -- never hardcoded", async () => {
    renderScreen();

    const summary = await screen.findByTestId('nutrition-goals-summary');
    expect(summary).toHaveTextContent(/Male/);
    expect(summary).toHaveTextContent(/24/);
    expect(summary).toHaveTextContent(/180 cm/);
    // 78 kg, shown in the person's lb.
    expect(summary).toHaveTextContent(/172 lb/);
    expect(summary.props.accessibilityLabel).toBe('Sex Male, Age 24, Height 180 cm, Weight 172 lb');
    expect(screen.getByTestId('nutrition-goals-activity')).toHaveTextContent('Moderately active');
  });

  it('navigates to CalorieEstimation when Edit is pressed', async () => {
    await opened();

    fireEvent.press(screen.getByTestId('nutrition-goals-edit'));

    expect(mockNavigate).toHaveBeenCalledWith('CalorieEstimation');
  });

  it('lays the page out as numbered steps: calories, macros, save', async () => {
    await opened();

    expect(screen.getByTestId('nutrition-goals-calories-card')).toHaveTextContent(
      /1Choose your calories/,
    );
    expect(screen.getByTestId('nutrition-goals-macros')).toHaveTextContent(/2Your macros/);
    expect(screen.getByTestId('nutrition-goals-save-card')).toHaveTextContent(/3Save your targets/);
  });

  it('shows the four real calculated calorie estimates, from the Mifflin-St Jeor formula', async () => {
    await opened();

    expect(screen.getByTestId('nutrition-goals-option-maintenance-value')).toHaveTextContent(
      estimates.maintenance.toLocaleString(),
    );
    expect(screen.getByTestId('nutrition-goals-option-surplus-value')).toHaveTextContent(
      estimates.surplus.toLocaleString(),
    );
    expect(screen.getByTestId('nutrition-goals-option-deficit-value')).toHaveTextContent(
      estimates.deficit.toLocaleString(),
    );
    expect(screen.getByTestId('nutrition-goals-option-aggressive-value')).toHaveTextContent(
      estimates.aggressiveDeficit.toLocaleString(),
    );
    expect(screen.getByTestId('nutrition-goals-estimate-note')).toHaveTextContent(
      /Mifflin-St Jeor/,
    );
  });

  it('makes a tapped estimate the calorie target and shows it chosen -- none is chosen by itself', async () => {
    await opened();

    const ids = ['aggressive', 'deficit', 'maintenance', 'surplus'].map(
      (key) => `nutrition-goals-option-${key}`,
    );
    const chosen = () =>
      ids.filter((id) => screen.getByTestId(id).props.accessibilityState.selected);
    expect(screen.getByTestId('nutrition-goals-calories')).toHaveProp('value', '');
    expect(chosen()).toEqual([]);

    fireEvent.press(screen.getByTestId('nutrition-goals-option-deficit'));

    expect(screen.getByTestId('nutrition-goals-calories')).toHaveProp(
      'value',
      String(estimates.deficit),
    );
    expect(chosen()).toEqual(['nutrition-goals-option-deficit']);
    expect(mockNavigate).not.toHaveBeenCalled();

    // Typing the same number as an estimate shows that one chosen too.
    fireEvent.changeText(
      screen.getByTestId('nutrition-goals-calories'),
      String(estimates.maintenance),
    );
    expect(chosen()).toEqual(['nutrition-goals-option-maintenance']);
  });

  it('asks for the details instead of showing made-up estimates when the profile is incomplete', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, activityLevel: null });
    renderScreen();

    await screen.findByTestId('nutrition-goals-incomplete');
    expect(screen.queryByTestId('nutrition-goals-option-maintenance')).toBeNull();
    // A calorie target can still be typed.
    expect(screen.getByTestId('nutrition-goals-calories')).toBeTruthy();
    fireEvent.press(screen.getByTestId('nutrition-goals-complete-profile'));
    expect(mockNavigate).toHaveBeenCalledWith('CalorieEstimation');
  });

  it('fills the fields from the saved targets, carbs worked out from them', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2400,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });
    await opened();

    expect(screen.getByTestId('nutrition-goals-calories')).toHaveProp('value', '2400');
    expect(screen.getByTestId('nutrition-goals-protein')).toHaveProp('value', '180');
    expect(screen.getByTestId('nutrition-goals-fat')).toHaveProp('value', '60');
    // 2,400 - 180 x 4 - 60 x 9 = 1,140 cal, or 285 g.
    expect(screen.getByTestId('nutrition-goals-carbs')).toHaveTextContent('285 g');
    expect(screen.queryByTestId('nutrition-goals-filled-note')).toBeNull();
  });

  it('fills blank protein and fat from body weight, says so, and saves nothing by itself', async () => {
    await opened();

    // 78 kg is 172 lb: 0.8 g protein and 0.3 g fat per lb.
    expect(screen.getByTestId('nutrition-goals-protein')).toHaveProp('value', '138');
    expect(screen.getByTestId('nutrition-goals-fat')).toHaveProp('value', '52');
    expect(screen.getByTestId('nutrition-goals-filled-note')).toHaveTextContent(
      'Protein and fat are filled in from your weight. Save to keep them.',
    );
    expect(mockSaveNutritionGoals).not.toHaveBeenCalled();
  });

  it('shows the rule each macro follows, from the body weight', async () => {
    await opened();

    expect(screen.getByTestId('nutrition-goals-guidance')).toHaveTextContent(
      'From your body weight, 172 lb',
    );
    expect(screen.getByTestId('nutrition-goals-protein-rule')).toHaveTextContent('0.8 g × 172 lb');
    expect(screen.getByTestId('nutrition-goals-fat-rule')).toHaveTextContent('0.3 g × 172 lb');
  });

  it("offers the rule's number beside a macro the person set differently, and uses it only on a tap", async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2400,
      proteinG: 180,
      carbsG: null,
      fatG: 52,
    });
    await opened();

    expect(screen.getByTestId('nutrition-goals-protein')).toHaveProp('value', '180');
    expect(screen.queryByTestId('nutrition-goals-fat-use')).toBeNull();
    fireEvent.press(screen.getByTestId('nutrition-goals-protein-use'));

    expect(screen.getByTestId('nutrition-goals-protein')).toHaveProp('value', '138');
    expect(screen.queryByTestId('nutrition-goals-protein-use')).toBeNull();
  });

  it('works carbs out from the calories left after protein and fat -- they are never typed', async () => {
    await opened();

    expect(screen.getByTestId('nutrition-goals-carbs-rule')).toHaveTextContent(
      'Set your calories to work out carbs.',
    );
    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '2200');
    fireEvent.changeText(screen.getByTestId('nutrition-goals-protein'), '160');
    fireEvent.changeText(screen.getByTestId('nutrition-goals-fat'), '60');

    expect(screen.getByTestId('nutrition-goals-carbs')).toHaveTextContent('255 g');
    expect(screen.getByTestId('nutrition-goals-carbs-rule')).toHaveTextContent(
      '1,020 cal left after protein and fat, ÷ 4',
    );
    expect(screen.getByTestId('nutrition-goals-summary-carbs')).toHaveTextContent(/255 g/);
    // Calories, protein and fat are the only fields.
    expect(screen.UNSAFE_queryAllByType(RNTextInput)).toHaveLength(3);

    fireEvent.changeText(screen.getByTestId('nutrition-goals-protein'), '');
    expect(screen.getByTestId('nutrition-goals-carbs')).toHaveTextContent('—');
    expect(screen.getByTestId('nutrition-goals-carbs-rule')).toHaveTextContent(
      'Add protein and fat to work out carbs.',
    );
  });

  it('explains protein and fat that pass the calories, and holds Save until one changes', async () => {
    await opened();

    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '1500');
    fireEvent.changeText(screen.getByTestId('nutrition-goals-protein'), '200');
    fireEvent.changeText(screen.getByTestId('nutrition-goals-fat'), '100');

    expect(screen.getByTestId('nutrition-goals-conflict')).toHaveTextContent(
      /Protein and fat come to 1,700 cal, 200 more than your 1,500 cal/,
    );
    expect(screen.getByTestId('nutrition-goals-carbs')).toHaveTextContent('—');
    expect(screen.getByTestId('nutrition-goals-save').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '2000');
    expect(screen.queryByTestId('nutrition-goals-conflict')).toBeNull();
    expect(screen.getByTestId('nutrition-goals-save').props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('asks for a body weight when there is none, and fills nothing in', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, weightValue: null });
    await opened();

    expect(screen.getByTestId('nutrition-goals-no-weight')).toHaveTextContent(
      /0.8 g and 0.3 g per lb/,
    );
    expect(screen.getByTestId('nutrition-goals-protein')).toHaveProp('value', '');
    expect(screen.getByTestId('nutrition-goals-protein-rule')).toHaveTextContent('0.8 g per lb');
    fireEvent.press(screen.getByTestId('nutrition-goals-add-weight'));
    expect(mockNavigate).toHaveBeenCalledWith('CalorieEstimation');
  });

  it('rejects a non-whole calorie target and disables Save', async () => {
    await opened();

    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '2400.5');

    expect(screen.getByTestId('nutrition-goals-save').props.accessibilityState.disabled).toBe(true);
  });

  it('saves calories, protein, fat and the carbs worked out from them', async () => {
    mockSaveNutritionGoals.mockImplementation(async (_user: string, goals: object) => goals);
    await opened();

    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '2200');
    await act(async () => {
      fireEvent.press(screen.getByTestId('nutrition-goals-save'));
    });

    // 2,200 - 138 x 4 - 52 x 9 = 1,180 cal, or 295 g.
    expect(mockSaveNutritionGoals).toHaveBeenCalledWith('user-1', {
      calories: 2200,
      proteinG: 138,
      carbsG: 295,
      fatG: 52,
    });
    expect(screen.getByTestId('nutrition-goals-saved')).toHaveTextContent(/Saved/);
    expect(screen.queryByTestId('nutrition-goals-filled-note')).toBeNull();
  });

  it('saves a blank field as no target, and carbs with it', async () => {
    mockSaveNutritionGoals.mockImplementation(async (_user: string, goals: object) => goals);
    await opened();

    fireEvent.changeText(screen.getByTestId('nutrition-goals-calories'), '2200');
    fireEvent.changeText(screen.getByTestId('nutrition-goals-protein'), '');
    await act(async () => {
      fireEvent.press(screen.getByTestId('nutrition-goals-save'));
    });

    expect(mockSaveNutritionGoals).toHaveBeenCalledWith('user-1', {
      calories: 2200,
      proteinG: null,
      carbsG: null,
      fatG: 52,
    });
  });

  it('shows an error message when saving fails', async () => {
    mockFetchNutritionGoals.mockResolvedValue({ ...emptyGoals, calories: 2000 });
    mockSaveNutritionGoals.mockRejectedValue(new Error('network error'));
    await opened();

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

  it('recalculates the estimates and the rule whenever the shared profile cache updates elsewhere, never the targets', async () => {
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
          <PhaseProvider>
            <CaptureUpdateProfile />
            <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'nutrition' }}>
              <NutritionGoalsScreen navigation={navigation} route={route} />
            </AppMenuContext.Provider>
          </PhaseProvider>
        </NutritionGoalsProvider>
      </ProfileProvider>,
    );
    await screen.findByTestId('nutrition-goals-scroll');
    const initialMaintenance = screen.getByTestId('nutrition-goals-option-maintenance-value').props
      .children;

    await act(async () => {
      await capturedUpdateProfile?.({ weightValue: 95 });
    });

    expect(screen.getByTestId('nutrition-goals-summary')).toHaveTextContent(/209.4 lb/);
    expect(
      screen.getByTestId('nutrition-goals-option-maintenance-value').props.children,
    ).not.toEqual(initialMaintenance);
    // A new weight changes the rule's numbers, never a target: they're offered, not put in.
    expect(screen.getByTestId('nutrition-goals-calories')).toHaveProp('value', '2100');
    expect(screen.getByTestId('nutrition-goals-protein')).toHaveProp('value', '138');
    expect(screen.getByTestId('nutrition-goals-protein-use')).toHaveTextContent('Use 168 g');
    expect(mockSaveNutritionGoals).not.toHaveBeenCalled();
  });

  it('shows a concise Important Notes section', async () => {
    await opened();

    expect(screen.getByTestId('nutrition-goals-notes')).toHaveTextContent(/estimates/i);
  });
});

describe('NutritionGoalsScreen -- tiles, rows and one primary action', () => {
  it('is five widgets: your details, the three steps and the notes', async () => {
    await opened();

    const cards = screen.UNSAFE_queryAllByType(AppCard);
    expect(cards.map((c) => c.props.testID)).toEqual([
      'nutrition-goals-info-card',
      'nutrition-goals-calories-card',
      'nutrition-goals-macros',
      'nutrition-goals-save-card',
      'nutrition-goals-notes',
    ]);
    expect(cards.map((c) => Boolean(c.props.hero))).toEqual([true, false, false, false, false]);
  });

  it('shows the estimates as tiles with the calories as a mono readout', async () => {
    await opened();

    const value = StyleSheet.flatten(
      screen.getByTestId('nutrition-goals-option-maintenance-value').props.style,
    );
    expect(value.fontFamily).toBe(fonts.mono);
    expect(screen.getByTestId('nutrition-goals-option-maintenance')).toHaveTextContent(
      /Holds your weight/,
    );
    expect(screen.getByTestId('nutrition-goals-option-deficit')).toHaveTextContent(
      /−300 cal a day/,
    );
    expect(screen.getByTestId('nutrition-goals-option-surplus')).toHaveTextContent(
      /\+300 cal a day/,
    );
    expect(screen.getByTestId('nutrition-goals-option-aggressive').props.accessibilityLabel).toBe(
      `Aggressive Loss, ${estimates.aggressiveDeficit.toLocaleString()} calories a day`,
    );
  });

  it('labels the target fields and offers Edit as a plain 44pt text action', async () => {
    await opened();

    expect(screen.getByTestId('nutrition-goals-calories').props.accessibilityLabel).toBe(
      'Or type your own',
    );
    expect(screen.getByTestId('nutrition-goals-protein').props.accessibilityLabel).toBe(
      'Protein (g)',
    );
    expect(screen.getByTestId('nutrition-goals-fat').props.accessibilityLabel).toBe('Fat (g)');
    const edit = screen.getByTestId('nutrition-goals-edit');
    expect(StyleSheet.flatten(edit.props.style).borderWidth).toBeUndefined();
    expect(StyleSheet.flatten(edit.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('has one filled Save that reports busy while saving', async () => {
    mockSaveNutritionGoals.mockReturnValue(new Promise(() => undefined));
    await opened();

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
    await opened();

    expectNoBareText();
  });
});

describe('NutritionGoalsScreen -- a phase with its own targets', () => {
  afterEach(() => {
    (fetchPhases as jest.Mock).mockResolvedValue([]);
  });

  it("says the phase's targets are used in place of these, which stay as they are", async () => {
    mockFetchNutritionGoals.mockResolvedValue({ ...emptyGoals, calories: 2200 });
    (fetchPhases as jest.Mock).mockResolvedValue([
      {
        id: 'phase-1',
        kind: 'cut',
        name: null,
        startDate: '2026-10-01',
        endDate: null,
        startWeightKg: 90,
        targetWeightKg: 85,
        targets: { calories: 1800, proteinG: null, carbsG: null, fatG: null },
        notes: null,
      },
    ]);
    renderScreen();

    expect(await screen.findByTestId('nutrition-goals-phase-note')).toHaveTextContent(
      /Your Cut has targets of its own/,
    );
    // The daily target itself is untouched.
    expect(screen.getByTestId('nutrition-goals-calories')).toHaveProp('value', '2200');
    fireEvent.press(screen.getByTestId('nutrition-goals-view-phase'));
    expect(mockNavigate).toHaveBeenCalledWith('Phases');
  });
});
