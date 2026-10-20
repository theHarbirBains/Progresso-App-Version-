import { Image, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { AppMenuContext } from '../navigation/AppMenuContext';
import {
  copyFoodLogs,
  deleteFoodLog,
  fetchFoodLogsForDay,
  fetchFoodLogsForRange,
  fetchTodaysFoodLogs,
  logFood,
  updateFoodLogQuantity,
} from '../nutrition/foodLogQueries';
import { fetchFoodsByIds } from '../nutrition/foodQueries';
import { createSavedMeal } from '../nutrition/savedMealQueries';
import {
  FoodLogProvider,
  useFoodLog,
  type FoodLogContextValue,
} from '../nutrition/FoodLogProvider';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { NutritionGoalsProvider } from '../nutrition/NutritionGoalsProvider';
import { ProfileProvider } from '../profile/ProfileProvider';
import { NutritionTodayScreen } from './NutritionTodayScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

// The profile isn't part of these tests; leave it loading.
jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(() => new Promise(() => {})),
}));

jest.mock('../nutrition/foodLogQueries', () => ({
  fetchTodaysFoodLogs: jest.fn(),
  fetchFoodLogsForDay: jest.fn(),
  fetchFoodLogsForRange: jest.fn(),
  copyFoodLogs: jest.fn(),
  updateFoodLogQuantity: jest.fn(),
  deleteFoodLog: jest.fn(),
  logFood: jest.fn(),
}));

jest.mock('../nutrition/foodQueries', () => ({
  fetchFoodsByIds: jest.fn(),
}));

jest.mock('../nutrition/savedMealQueries', () => ({
  createSavedMeal: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchTodaysFoodLogs = fetchTodaysFoodLogs as jest.Mock;
const mockUpdateFoodLogQuantity = updateFoodLogQuantity as jest.Mock;
const mockDeleteFoodLog = deleteFoodLog as jest.Mock;
const mockFetchNutritionGoals = fetchNutritionGoals as jest.Mock;
const mockLogFood = logFood as jest.Mock;
const mockFetchFoodLogsForDay = fetchFoodLogsForDay as jest.Mock;
const mockFetchFoodLogsForRange = fetchFoodLogsForRange as jest.Mock;
const mockCopyFoodLogs = copyFoodLogs as jest.Mock;
const mockFetchFoodsByIds = fetchFoodsByIds as jest.Mock;
const mockCreateSavedMeal = createSavedMeal as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;
const mockOpenMenu = jest.fn();

// NutritionTodayScreen opens the app-level side menu (via AppMenuContext)
// from its own header, same as every other tab-root screen -- this stands in
// for that root-level provider.
function renderScreen() {
  return render(
    <ProfileProvider>
      <NutritionGoalsProvider>
        <FoodLogProvider>
          <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'nutrition' }}>
            <NutritionTodayScreen navigation={navigation} route={route} />
          </AppMenuContext.Provider>
        </FoodLogProvider>
      </NutritionGoalsProvider>
    </ProfileProvider>,
  );
}

const sampleLog = {
  id: 'log-1',
  foodId: 'food-1',
  foodNameSnapshot: 'Chicken Breast',
  servingSize: 100,
  servingUnit: 'g',
  quantity: 2,
  calories: 330,
  proteinG: 62,
  carbsG: 0,
  fatG: 7.2,
  loggedAt: '2026-01-01T12:00:00Z',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchTodaysFoodLogs.mockReset().mockResolvedValue([]);
  mockFetchNutritionGoals.mockReset().mockResolvedValue({
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  mockUpdateFoodLogQuantity.mockReset();
  mockDeleteFoodLog.mockReset();
  mockLogFood.mockReset();
  mockFetchFoodLogsForDay.mockReset().mockResolvedValue([]);
  mockFetchFoodLogsForRange.mockReset().mockResolvedValue([]);
  mockCopyFoodLogs.mockReset();
  mockFetchFoodsByIds.mockReset();
  mockCreateSavedMeal.mockReset();
  mockGoBack.mockClear();
  mockNavigate.mockClear();
});

// CalorieRing hides its own value text from the accessibility tree (its
// single accessibilityLabel covers it) -- see CalorieRing.test.tsx.
const includeHidden = { includeHiddenElements: true };

describe('NutritionTodayScreen', () => {
  it('shows a loading indicator while fetching', async () => {
    renderScreen();

    expect(screen.getByTestId('nutrition-today-loading')).toBeTruthy();

    // Let the in-flight load settle inside act() before the test ends, so
    // React doesn't warn about a state update after the test already returned.
    await screen.findByTestId('food-log-empty');
  });

  it('shows an error message when loading fails', async () => {
    mockFetchTodaysFoodLogs.mockRejectedValue(new Error('network error'));

    renderScreen();

    expect(await screen.findByTestId('nutrition-today-error')).toHaveTextContent('network error');
  });

  it('shows an empty state when no foods are logged today', async () => {
    renderScreen();

    expect(await screen.findByTestId('food-log-empty')).toBeTruthy();
    expect(
      screen.getByTestId('nutrition-today-calorie-ring-value', includeHidden),
    ).toHaveTextContent('0');
  });

  it('shows consumed totals without targets/remaining when no goals are set', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);

    renderScreen();

    expect(await screen.findByTestId('food-log-row-log-1')).toBeTruthy();
    expect(
      screen.getByTestId('nutrition-today-calorie-ring-value', includeHidden),
    ).toHaveTextContent('330');
    expect(screen.queryByTestId('calories-remaining')).toBeNull();
  });

  it('shows targets and remaining values when goals are configured', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });

    renderScreen();

    expect(
      await screen.findByTestId('nutrition-today-calorie-ring-value', includeHidden),
    ).toHaveTextContent('330');
    expect(screen.getByTestId('nutrition-today-calorie-ring')).toHaveTextContent(/of 2000 cal/);
    expect(screen.getByTestId('calories-remaining')).toHaveTextContent('1670 cal remaining');
    // Each macro: what's been eaten against the target, and a bar of the way there.
    expect(screen.getByTestId('protein-consumed')).toHaveTextContent('62g');
    expect(screen.getByTestId('protein-goal')).toHaveTextContent('/ 180g');
    expect(StyleSheet.flatten(screen.getByTestId('protein-bar').props.style).width).toBe(
      `${(62 / 180) * 100}%`,
    );
    expect(screen.getByTestId('protein-row').props.accessibilityLabel).toBe(
      'Protein, 62 of 180 grams',
    );
    // Daily Targets.
    expect(screen.getByTestId('target-calories')).toHaveTextContent(/2000/);
    expect(screen.getByTestId('target-protein')).toHaveTextContent(/180g/);
  });

  it('fills a macro bar no further than full when the target is passed', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: 50,
      carbsG: 200,
      fatG: 60,
    });
    renderScreen();

    const bar = await screen.findByTestId('protein-bar');
    expect(StyleSheet.flatten(bar.props.style).width).toBe('100%');
  });

  it('shows no target, bar or remaining for a macro with no target, and "—" under Daily Targets', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    renderScreen();

    expect(await screen.findByTestId('protein-consumed')).toHaveTextContent('62g');
    expect(screen.queryByTestId('protein-goal')).toBeNull();
    expect(screen.queryByTestId('protein-bar')).toBeNull();
    expect(screen.getByTestId('target-calories')).toHaveTextContent(/—/);
  });

  it('lists each logged food with its snapshot values', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);

    renderScreen();

    expect(await screen.findByTestId('food-log-row-log-1')).toHaveTextContent(/Chicken Breast/);
    expect(screen.getByTestId('food-log-row-log-1')).toHaveTextContent(/330 cal/);
  });

  it('shows a log in the amount it was typed in, and edits it there', async () => {
    const cookies = {
      ...sampleLog,
      foodNameSnapshot: 'Oreo',
      servingSize: 34,
      servingUnit: 'g',
      servingLabel: '3 cookies (34 g)',
      quantity: 0.67,
      calories: 107,
      enteredAmount: 2,
      enteredUnit: 'pieces' as const,
    };
    mockFetchTodaysFoodLogs.mockResolvedValue([cookies]);
    mockUpdateFoodLogQuantity.mockResolvedValue({
      ...cookies,
      quantity: 1,
      calories: 160,
      enteredAmount: 3,
    });

    renderScreen();
    await screen.findByTestId('food-log-row-log-1');
    expect(screen.getByTestId('food-log-quantity-log-1')).toHaveProp('value', '2');
    expect(screen.getByTestId('food-log-unit-log-1')).toHaveTextContent('cookies');

    fireEvent.changeText(screen.getByTestId('food-log-quantity-log-1'), '3');
    await act(async () => {
      fireEvent(screen.getByTestId('food-log-quantity-log-1'), 'endEditing');
    });

    // 3 cookies of a 3-cookie serving is 1 serving, and stays 3 cookies.
    expect(mockUpdateFoodLogQuantity).toHaveBeenCalledWith(cookies, 1, {
      amount: 3,
      unit: 'pieces',
    });
    expect(screen.getByTestId('food-log-quantity-log-1')).toHaveProp('value', '3');
  });

  it('edits grams as grams', async () => {
    const grams = { ...sampleLog, enteredAmount: 200, enteredUnit: 'g' as const };
    mockFetchTodaysFoodLogs.mockResolvedValue([grams]);
    mockUpdateFoodLogQuantity.mockResolvedValue({ ...grams, quantity: 1.5, enteredAmount: 150 });

    renderScreen();
    await screen.findByTestId('food-log-row-log-1');
    expect(screen.getByTestId('food-log-unit-log-1')).toHaveTextContent('g');

    fireEvent.changeText(screen.getByTestId('food-log-quantity-log-1'), '150');
    await act(async () => {
      fireEvent(screen.getByTestId('food-log-quantity-log-1'), 'endEditing');
    });

    expect(mockUpdateFoodLogQuantity).toHaveBeenCalledWith(grams, 1.5, { amount: 150, unit: 'g' });
  });

  it('updates a quantity and re-sums totals from the returned log', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    mockUpdateFoodLogQuantity.mockResolvedValue({
      ...sampleLog,
      quantity: 3,
      calories: 495,
      proteinG: 93,
    });

    renderScreen();
    await screen.findByTestId('food-log-row-log-1');

    fireEvent.changeText(screen.getByTestId('food-log-quantity-log-1'), '3');
    await act(async () => {
      fireEvent(screen.getByTestId('food-log-quantity-log-1'), 'endEditing');
    });

    expect(mockUpdateFoodLogQuantity).toHaveBeenCalledWith(sampleLog, 3, undefined);
    await waitFor(() =>
      expect(
        screen.getByTestId('nutrition-today-calorie-ring-value', includeHidden),
      ).toHaveTextContent('495'),
    );
  });

  it('deletes a food log and removes it from the list', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    mockDeleteFoodLog.mockResolvedValue(undefined);

    renderScreen();
    await screen.findByTestId('food-log-row-log-1');

    await act(async () => {
      fireEvent.press(screen.getByTestId('food-log-delete-log-1'));
    });

    expect(mockDeleteFoodLog).toHaveBeenCalledWith('log-1');
    await waitFor(() => expect(screen.queryByTestId('food-log-row-log-1')).toBeNull());
    expect(screen.getByTestId('food-log-empty')).toBeTruthy();
  });

  it('navigates to FoodLibrary when Log Food is pressed', async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('log-food-button'));

    expect(mockNavigate).toHaveBeenCalledWith('FoodLibrary');
  });

  it('does not show AI Food Search as a button -- it lives inside Food Library', async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    expect(screen.queryByTestId('ai-food-search-button')).toBeNull();
  });

  it('opens Nutrition History from View All, and Nutrition Goals from Edit Targets', async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('nutrition-today-view-all'));
    expect(mockNavigate).toHaveBeenCalledWith('NutritionHistory');
    fireEvent.press(screen.getByTestId('nutrition-today-edit-targets'));
    expect(mockNavigate).toHaveBeenCalledWith('NutritionGoals');
  });

  it('offers to log the first meal when nothing is logged yet -- with no caption under it', async () => {
    renderScreen();

    expect(await screen.findByTestId('food-log-empty')).toHaveTextContent('No foods logged today');
    expect(screen.queryByText(/Start by logging/)).toBeNull();
    fireEvent.press(screen.getByTestId('food-log-empty-log'));
    expect(mockNavigate).toHaveBeenCalledWith('FoodLibrary');
  });

  it('navigates to the barcode scanner when Scan Barcode is pressed', async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('scan-barcode-button'));

    expect(mockNavigate).toHaveBeenCalledWith('BarcodeScanner');
  });

  it('navigates to FoodSearch when Search Food is pressed', async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('search-food-button'));

    expect(mockNavigate).toHaveBeenCalledWith('FoodSearch');
  });

  it('opens the app-level side menu when the header button is pressed', async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    fireEvent.press(screen.getByTestId('nutrition-today-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith();
  });
});

// Regression coverage for a reported bug: returning to this screen briefly
// blanked it with a full-screen spinner before the refreshed data arrived.
// This screen no longer fetches on its own focus at all -- today's logs
// come from the shared FoodLogProvider cache, write-through from wherever a
// food is actually logged, edited or deleted (see that provider's own
// comment) -- so the regression is now structurally impossible.
describe('NutritionTodayScreen background refresh from the shared cache', () => {
  it('does not show the loading indicator when a food is logged elsewhere and the shared cache updates', async () => {
    // Simulates LogFoodStep -- reached from FoodLibrary/FoodSearch/Barcode
    // Scanner, not rendered here -- logging a food via the same shared
    // logFoodEntry.
    let capturedLogFoodEntry: FoodLogContextValue['logFoodEntry'] | undefined;
    function CaptureLogFoodEntry() {
      capturedLogFoodEntry = useFoodLog().logFoodEntry;
      return null;
    }

    render(
      <ProfileProvider>
        <NutritionGoalsProvider>
          <FoodLogProvider>
            <CaptureLogFoodEntry />
            <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'nutrition' }}>
              <NutritionTodayScreen navigation={navigation} route={route} />
            </AppMenuContext.Provider>
          </FoodLogProvider>
        </NutritionGoalsProvider>
      </ProfileProvider>,
    );
    await screen.findByTestId('food-log-empty');

    mockLogFood.mockResolvedValue({ ...sampleLog, id: 'log-2' });
    await act(async () => {
      await capturedLogFoodEntry?.(
        {
          id: 'food-1',
          name: 'Chicken Breast',
          servingSize: 100,
          servingUnit: 'g',
          calories: 330,
          proteinG: 62,
          carbsG: 0,
          fatG: 7.2,
        },
        2,
        'lunch',
      );
    });

    expect(screen.queryByTestId('nutrition-today-loading')).toBeNull();
    expect(await screen.findByTestId('food-log-row-log-2')).toBeTruthy();
  });
});

describe('NutritionTodayScreen -- widgets, one primary action', () => {
  it("is five widgets: today's intake (the hero), the week, the actions, today's foods and the daily targets", async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    renderScreen();
    await screen.findByTestId('food-log-row-log-1');

    const cards = screen.UNSAFE_queryAllByType(AppCard);
    expect(cards.map((c) => c.props.testID)).toEqual([
      'nutrition-today-macros',
      'nutrition-today-week',
      'nutrition-today-actions',
      'nutrition-today-foods',
      'nutrition-today-targets',
    ]);
    expect(cards.map((c) => Boolean(c.props.hero))).toEqual([true, false, false, false, false]);
    expect(
      within(screen.getByTestId('nutrition-today-foods')).getByTestId('food-log-row-log-1'),
    ).toBeTruthy();
  });

  it("shows the logged food's photo when it has one, and a glyph when it does not", async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([
      { ...sampleLog, imageUrl: 'https://images.example/a.jpg' },
      { ...sampleLog, id: 'log-2', imageUrl: null },
    ]);
    renderScreen();

    const withPhoto = await screen.findByTestId('food-log-row-log-1');
    expect(within(withPhoto).UNSAFE_getByType(Image).props.source).toEqual({
      uri: 'https://images.example/a.jpg',
    });
    expect(
      within(screen.getByTestId('food-log-row-log-2')).UNSAFE_queryAllByType(Image),
    ).toHaveLength(0);
  });

  it('has one filled button -- Log Food -- with Search Food outlined', async () => {
    renderScreen();
    await screen.findByTestId('log-food-button');

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    const searchFood = StyleSheet.flatten(screen.getByTestId('search-food-button').props.style);
    expect(searchFood.backgroundColor).toBeUndefined();
    expect(searchFood.borderWidth).toBe(1);
  });

  it('names the menu control for assistive tech', async () => {
    renderScreen();
    await screen.findByTestId('log-food-button');

    expect(screen.getByTestId('nutrition-today-open-menu').props.accessibilityLabel).toBe(
      'Open menu',
    );
  });

  it('shows each logged food as a row with a named quantity field and a quiet destructive Delete', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    renderScreen();

    const row = await screen.findByTestId(`food-log-row-${sampleLog.id}`);
    expect(row).toBeTruthy();
    expect(
      screen.getByTestId(`food-log-quantity-${sampleLog.id}`).props.accessibilityLabel,
    ).toMatch(/^Amount of Chicken Breast, in servings/);
    const del = screen.getByTestId(`food-log-delete-${sampleLog.id}`);
    expect(del.props.accessibilityLabel).toMatch(/^Delete /);
    expect(StyleSheet.flatten(del.props.style).borderWidth).toBeUndefined();
    expect(StyleSheet.flatten(del.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    renderScreen();
    await screen.findByTestId(`food-log-row-${sampleLog.id}`);

    expectNoBareText();
  });
});

describe('NutritionTodayScreen -- Copy Yesterday', () => {
  const toast = { ...sampleLog, id: 'y-1', foodId: 'food-toast', foodNameSnapshot: 'Toast' };
  const eggs = {
    ...sampleLog,
    id: 'y-2',
    foodId: 'food-eggs',
    foodNameSnapshot: 'Eggs',
    quantity: 1,
    calories: 140,
    enteredAmount: 2,
    enteredUnit: 'servings',
  };

  it("reads yesterday's foods, and offers nothing to copy when there are none", async () => {
    renderScreen();
    await screen.findByTestId('food-log-empty');

    const [, day] = mockFetchFoodLogsForDay.mock.calls[0]!;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect((day as Date).toDateString()).toBe(yesterday.toDateString());
    expect(screen.queryByTestId('nutrition-today-copy-yesterday')).toBeNull();
    expect(screen.queryByTestId('nutrition-today-save-meal')).toBeNull();
  });

  it("logs yesterday's foods again, all ticked, leaving out any unticked", async () => {
    mockFetchFoodLogsForDay.mockResolvedValue([toast, eggs]);
    mockCopyFoodLogs.mockResolvedValue([
      { ...eggs, id: 'new-1', loggedAt: new Date().toISOString() },
    ]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('nutrition-today-copy-yesterday'));
    expect(screen.getByTestId('copy-yesterday-item-y-2')).toHaveTextContent(/2 servings · 140 cal/);
    expect(screen.getByTestId('copy-yesterday-submit')).toHaveTextContent('Log 2 Foods');

    fireEvent.press(screen.getByTestId('copy-yesterday-item-y-1'));
    expect(screen.getByTestId('copy-yesterday-item-y-1').props.accessibilityLabel).toMatch(
      /not selected/,
    );
    expect(screen.getByTestId('copy-yesterday-submit')).toHaveTextContent('Log 1 Food');
    await act(async () => {
      fireEvent.press(screen.getByTestId('copy-yesterday-submit'));
    });

    expect(mockCopyFoodLogs).toHaveBeenCalledWith('user-1', ['y-2']);
    // The copy is in Today's Foods straight away.
    expect(await screen.findByTestId('food-log-row-new-1')).toBeTruthy();
  });

  it('can be used before anything is logged today', async () => {
    mockFetchFoodLogsForDay.mockResolvedValue([toast]);
    renderScreen();

    expect(await screen.findByTestId('food-log-empty')).toBeTruthy();
    expect(await screen.findByTestId('nutrition-today-copy-yesterday')).toBeTruthy();
  });

  it('shows why nothing was copied when it fails', async () => {
    mockFetchFoodLogsForDay.mockResolvedValue([toast]);
    mockCopyFoodLogs.mockRejectedValue(new Error('network error'));
    renderScreen();

    fireEvent.press(await screen.findByTestId('nutrition-today-copy-yesterday'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('copy-yesterday-submit'));
    });

    expect(screen.getByTestId('copy-yesterday-error')).toHaveTextContent('network error');
  });
});

describe('NutritionTodayScreen -- Save as Meal', () => {
  const chicken = {
    id: 'food-1',
    name: 'Chicken Breast',
    brand: null,
    barcode: null,
    imageUrl: null,
    servingSize: 100,
    servingUnit: 'g',
    calories: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
    isActive: true,
  };

  it("names today's foods and keeps them as a saved meal, at today's amounts", async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([
      { ...sampleLog, enteredAmount: 200, enteredUnit: 'g' },
    ]);
    mockFetchFoodsByIds.mockResolvedValue([chicken]);
    mockCreateSavedMeal.mockResolvedValue({});
    renderScreen();

    fireEvent.press(await screen.findByTestId('nutrition-today-save-meal'));
    expect(screen.getByTestId('save-meal-submit').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('save-meal-name'), ' Lunch ');
    await act(async () => {
      fireEvent.press(screen.getByTestId('save-meal-submit'));
    });

    expect(mockFetchFoodsByIds).toHaveBeenCalledWith(['food-1']);
    expect(mockCreateSavedMeal).toHaveBeenCalledWith('user-1', 'Lunch', [
      { food: chicken, quantity: 2, entered: { amount: 200, unit: 'g' } },
    ]);
    expect(screen.getByTestId('save-meal-done')).toHaveTextContent('Lunch saved');
  });

  it("won't save a meal of foods no longer in the library", async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    mockFetchFoodsByIds.mockResolvedValue([{ ...chicken, isActive: false }]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('nutrition-today-save-meal'));
    fireEvent.changeText(screen.getByTestId('save-meal-name'), 'Lunch');
    await act(async () => {
      fireEvent.press(screen.getByTestId('save-meal-submit'));
    });

    expect(mockCreateSavedMeal).not.toHaveBeenCalled();
    expect(screen.getByTestId('save-meal-error')).toHaveTextContent(/any more/);
  });
});

describe("NutritionTodayScreen -- the week's calorie budget", () => {
  // Only the clock is faked, so the screen's own reads still resolve normally.
  function setToday(date: Date) {
    jest.useFakeTimers({
      now: date,
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'hrtime',
        'performance',
      ],
    });
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  const goals = { calories: 2000, proteinG: null, carbsG: null, fatG: null };

  it("adds this week's earlier days to today's foods, against 7 times the daily target", async () => {
    // A Wednesday.
    setToday(new Date(2026, 9, 21, 12, 0));
    mockFetchNutritionGoals.mockResolvedValue(goals);
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    mockFetchFoodLogsForRange.mockResolvedValue([
      { ...sampleLog, id: 'mon', calories: 1800 },
      { ...sampleLog, id: 'tue', calories: 1200 },
    ]);
    renderScreen();

    expect(await screen.findByTestId('weekly-budget-remaining')).toHaveTextContent(
      '10,670 cal left · 5 days to go, today included',
    );
    expect(screen.getByTestId('weekly-budget-consumed')).toHaveTextContent('3,330');
    expect(screen.getByTestId('weekly-budget-target')).toHaveTextContent('/ 14,000 cal');
    // Monday 00:00 up to today 00:00 -- today's own come from the shared cache.
    expect(mockFetchFoodLogsForRange).toHaveBeenCalledWith(
      'user-1',
      new Date(2026, 9, 19),
      new Date(2026, 9, 21),
    );
  });

  it('moves at once when a food is deleted today', async () => {
    setToday(new Date(2026, 9, 21, 12, 0));
    mockFetchNutritionGoals.mockResolvedValue(goals);
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    mockFetchFoodLogsForRange.mockResolvedValue([{ ...sampleLog, id: 'mon', calories: 1000 }]);
    mockDeleteFoodLog.mockResolvedValue(undefined);
    renderScreen();
    expect(await screen.findByTestId('weekly-budget-consumed')).toHaveTextContent('1,330');

    await act(async () => {
      fireEvent.press(screen.getByTestId('food-log-delete-log-1'));
    });

    expect(screen.getByTestId('weekly-budget-consumed')).toHaveTextContent('1,000');
  });

  it('reads no earlier days on a Monday', async () => {
    setToday(new Date(2026, 9, 19, 12, 0));
    mockFetchNutritionGoals.mockResolvedValue(goals);
    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog]);
    renderScreen();

    expect(await screen.findByTestId('weekly-budget-remaining')).toHaveTextContent(
      '13,670 cal left · 7 days to go, today included',
    );
    expect(mockFetchFoodLogsForRange).not.toHaveBeenCalled();
  });

  it('offers to set a target when there is none', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('weekly-budget-set-target'));

    expect(mockNavigate).toHaveBeenCalledWith('NutritionGoals');
  });

  it("says when the week's earlier days couldn't be read", async () => {
    setToday(new Date(2026, 9, 21, 12, 0));
    mockFetchNutritionGoals.mockResolvedValue(goals);
    mockFetchFoodLogsForRange.mockRejectedValue(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('weekly-budget-error')).toBeTruthy();
  });
});
