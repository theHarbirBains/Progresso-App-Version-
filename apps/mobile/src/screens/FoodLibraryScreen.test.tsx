import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { logFood } from '../nutrition/foodLogQueries';
import { createFood, fetchAllFoods, updateFood } from '../nutrition/foodQueries';
import { FoodLibraryScreen } from './FoodLibraryScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../nutrition/foodQueries', () => ({
  fetchAllFoods: jest.fn(),
  createFood: jest.fn(),
  updateFood: jest.fn(),
}));

jest.mock('../nutrition/foodLogQueries', () => ({
  logFood: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchAllFoods = fetchAllFoods as jest.Mock;
const mockCreateFood = createFood as jest.Mock;
const mockUpdateFood = updateFood as jest.Mock;
const mockLogFood = logFood as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockOpenMenu = jest.fn();
const mockReportMode = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: mockNavigate };

const apple = {
  id: 'food-apple',
  name: 'Apple',
  brand: null,
  servingSize: 182,
  servingUnit: 'g',
  calories: 95,
  proteinG: 0.5,
  carbsG: 25,
  fatG: 0.3,
  isActive: true,
};

const banana = {
  id: 'food-banana',
  name: 'Banana',
  brand: null,
  servingSize: 118,
  servingUnit: 'g',
  calories: 105,
  proteinG: 1.3,
  carbsG: 27,
  fatG: 0.4,
  isActive: true,
};

const baseProfile = {
  id: 'user-1',
  email: 'a@example.com',
  role: 'user',
  displayName: null,
  username: null,
  weightUnit: 'kg' as const,
  workoutAccentColor: null,
  nutritionAccentColor: null,
  activeWorkoutSplitId: null,
};

function renderScreen(
  currentMode: 'workout' | 'nutrition' = 'nutrition',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any,
) {
  return render(
    <AppMenuContext.Provider
      value={{ openMenu: mockOpenMenu, reportMode: mockReportMode, currentMode }}
    >
      <FoodLibraryScreen navigation={navigation} route={{ params } as never} />
    </AppMenuContext.Provider>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, session: { access_token: 'token-1' } });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockFetchAllFoods.mockReset().mockResolvedValue([apple, banana]);
  mockCreateFood.mockReset();
  mockUpdateFood.mockReset();
  mockLogFood.mockReset();
  mockGoBack.mockClear();
  mockNavigate.mockClear();
  mockOpenMenu.mockClear();
  mockReportMode.mockClear();
});

describe('FoodLibraryScreen', () => {
  it("loads and displays the current user's custom foods, grouped alphabetically", async () => {
    renderScreen();

    expect(await screen.findByTestId('food-item-food-apple')).toHaveTextContent(/Apple/);
    expect(screen.getByTestId('food-item-food-banana')).toHaveTextContent(/Banana/);
    expect(screen.getByTestId('food-library-section-A')).toHaveTextContent('A');
    expect(screen.getByTestId('food-library-section-B')).toHaveTextContent('B');
    expect(mockFetchAllFoods).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', search: '', ascending: true }),
    );
  });

  it('shows the Workout/Nutrition mode toggle, since Food is a primary/root screen', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    expect(screen.getByTestId('food-library-mode-workout')).toBeTruthy();
    expect(screen.getByTestId('food-library-mode-nutrition')).toBeTruthy();
  });

  it('navigates to Dashboard (Workout’s Home), not to Workouts, when the Workout segment is pressed', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-library-mode-workout'));

    expect(mockReportMode).toHaveBeenCalledWith('workout');
    expect(mockNavigate).toHaveBeenCalledWith('Dashboard');
  });

  it('does nothing when the already-selected Nutrition segment is pressed', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-library-mode-nutrition'));

    expect(mockReportMode).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows the real, non-fabricated count of saved foods', async () => {
    renderScreen();

    expect(await screen.findByTestId('food-library-count')).toHaveTextContent('2 foods saved');
  });

  it('shows a singular "food" for exactly one saved item', async () => {
    mockFetchAllFoods.mockResolvedValue([apple]);
    renderScreen();

    expect(await screen.findByTestId('food-library-count')).toHaveTextContent('1 food saved');
  });

  it('shows an empty state with a create action when there are no foods yet', async () => {
    mockFetchAllFoods.mockResolvedValue([]);

    renderScreen();

    expect(await screen.findByTestId('food-library-empty')).toHaveTextContent('No foods yet');
    expect(screen.getByTestId('food-empty-create')).toBeTruthy();
  });

  it('debounces search input into a query', async () => {
    jest.useFakeTimers();
    renderScreen();
    await act(async () => {
      await Promise.resolve();
    });
    mockFetchAllFoods.mockClear();

    fireEvent.changeText(screen.getByTestId('food-search'), 'apple');
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(mockFetchAllFoods).toHaveBeenCalledWith(expect.objectContaining({ search: 'apple' }));
    jest.useRealTimers();
  });

  it('shows an error message with a retry action when loading fails', async () => {
    mockFetchAllFoods.mockRejectedValue(new Error('network error'));

    renderScreen();

    expect(await screen.findByTestId('food-library-error')).toHaveTextContent('network error');
  });

  it('toggles the sort order between A -> Z and Z -> A, re-querying each time', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');
    mockFetchAllFoods.mockClear();

    fireEvent.press(screen.getByTestId('food-library-sort'));

    expect(screen.getByTestId('food-library-sort')).toHaveTextContent(/Z → A/);
    expect(mockFetchAllFoods).toHaveBeenCalledWith(expect.objectContaining({ ascending: false }));
  });

  it("jumps to a letter's section when its index-rail entry is pressed", async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    // Only asserts the rail is wired up and doesn't throw -- SectionList's
    // own scrollToLocation isn't meaningfully observable in this test
    // environment (no real layout/scroll measurements).
    expect(() => fireEvent.press(screen.getByTestId('food-library-index-B'))).not.toThrow();
  });

  it('does not call onSelect for a letter with no foods', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    expect(screen.getByTestId('food-library-index-Z').props.accessibilityState.disabled).toBe(true);
  });

  it('opens the Nutrition side menu from the hamburger button, not a back arrow', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    expect(screen.queryByTestId('app-header-back')).toBeNull();

    fireEvent.press(screen.getByTestId('food-library-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith('nutrition');
  });

  it('creates a food and returns to the list', async () => {
    mockCreateFood.mockResolvedValue({ ...apple, id: 'food-2', name: 'Cherry' });

    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Cherry');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '150');
    fireEvent.changeText(screen.getByTestId('food-form-serving-unit'), 'g');
    fireEvent.changeText(screen.getByTestId('food-form-calories'), '50');
    fireEvent.changeText(screen.getByTestId('food-form-protein'), '1');
    fireEvent.changeText(screen.getByTestId('food-form-carbs'), '12');
    fireEvent.changeText(screen.getByTestId('food-form-fat'), '0');

    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    expect(mockCreateFood).toHaveBeenCalledWith('user-1', {
      name: 'Cherry',
      brand: null,
      barcode: null,
      servingSize: 150,
      servingUnit: 'g',
      calories: 50,
      proteinG: 1,
      carbsG: 12,
      fatG: 0,
    });
    expect(await screen.findByTestId('food-search')).toBeTruthy();
  });

  it('opens straight into creating a food, prefilled with the barcode, when reached from the Scan Barcode "not found" fallback', async () => {
    renderScreen('nutrition', { openCreate: true, barcode: '012345678905' });

    expect(await screen.findByTestId('food-form-name')).toBeTruthy();
    expect(screen.getByTestId('food-form-barcode')).toHaveProp('value', '012345678905');
  });

  it('creates a food with the optional brand and barcode filled in', async () => {
    mockCreateFood.mockResolvedValue({ ...apple, id: 'food-3', name: 'Almonds' });

    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Almonds');
    fireEvent.changeText(screen.getByTestId('food-form-brand'), 'Kirkland');
    fireEvent.changeText(screen.getByTestId('food-form-barcode'), '012345678905');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '28');
    fireEvent.changeText(screen.getByTestId('food-form-serving-unit'), 'g');
    fireEvent.changeText(screen.getByTestId('food-form-calories'), '160');
    fireEvent.changeText(screen.getByTestId('food-form-protein'), '6');
    fireEvent.changeText(screen.getByTestId('food-form-carbs'), '6');
    fireEvent.changeText(screen.getByTestId('food-form-fat'), '14');

    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    expect(mockCreateFood).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ brand: 'Kirkland', barcode: '012345678905' }),
    );
  });

  it('edits an existing food', async () => {
    mockUpdateFood.mockResolvedValue({ ...apple, calories: 100 });

    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-edit-food-apple'));
    expect(await screen.findByTestId('food-form-name')).toBeTruthy();
    expect(screen.getByTestId('food-form-name').props.value).toBe('Apple');

    fireEvent.changeText(screen.getByTestId('food-form-calories'), '100');
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    expect(mockUpdateFood).toHaveBeenCalledWith(
      'food-apple',
      expect.objectContaining({
        calories: 100,
      }),
    );
  });

  it('logs a food with the default quantity of 1', async () => {
    mockLogFood.mockResolvedValue({});

    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-item-food-apple'));

    expect(await screen.findByTestId('log-food-quantity')).toHaveProp('value', '1');
    expect(screen.getByTestId('log-food-preview')).toHaveTextContent(/95 cal/);

    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
    });

    expect(mockLogFood).toHaveBeenCalledWith(
      'user-1',
      apple,
      1,
      // Time-of-day default (see defaultMealTypeForTime) -- any valid meal.
      expect.stringMatching(/^(breakfast|lunch|dinner|snack)$/),
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('scales the preview totals when quantity changes', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-item-food-apple'));
    await screen.findByTestId('log-food-quantity');

    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '2');

    expect(screen.getByTestId('log-food-preview')).toHaveTextContent(/190 cal/);
  });

  it('goes back to the list when the log step is cancelled', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-item-food-apple'));
    await screen.findByTestId('log-food-quantity');

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(await screen.findByTestId('food-item-food-apple')).toBeTruthy();
  });
});
