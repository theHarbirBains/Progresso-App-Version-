import { StackActions } from '@react-navigation/native';
import { Alert, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { uploadFoodPhoto } from '../lib/foodPhotoUpload';
import { searchFoods } from '../lib/foodsApi';
import { fetchTodaysFoodLogs, logFood } from '../nutrition/foodLogQueries';
import { FoodLogProvider } from '../nutrition/FoodLogProvider';
import {
  createFood,
  fetchAllFoods,
  fetchRecentFoods,
  fetchUsualFoods,
  updateFood,
} from '../nutrition/foodQueries';
import {
  createRecipe,
  deleteRecipe,
  fetchRecipeIngredients,
  updateRecipe,
} from '../nutrition/recipeQueries';
import {
  createSavedMeal,
  deleteSavedMeal,
  fetchSavedMeals,
  updateSavedMeal,
} from '../nutrition/savedMealQueries';
import { ProfileProvider } from '../profile/ProfileProvider';
import { FoodLibraryScreen } from './FoodLibraryScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../nutrition/foodQueries', () => ({
  fetchAllFoods: jest.fn(),
  fetchRecentFoods: jest.fn(),
  fetchUsualFoods: jest.fn(),
  createFood: jest.fn(),
  updateFood: jest.fn(),
}));

jest.mock('../nutrition/savedMealQueries', () => ({
  fetchSavedMeals: jest.fn(),
  createSavedMeal: jest.fn(),
  updateSavedMeal: jest.fn(),
  deleteSavedMeal: jest.fn(),
}));

jest.mock('../nutrition/recipeQueries', () => ({
  fetchRecipeIngredients: jest.fn(),
  createRecipe: jest.fn(),
  updateRecipe: jest.fn(),
  deleteRecipe: jest.fn(),
}));

jest.mock('../lib/foodsApi', () => ({
  searchFoods: jest.fn(),
}));

jest.mock('../lib/foodPhotoUpload', () => ({
  uploadFoodPhoto: jest.fn(),
}));

jest.mock('../nutrition/foodLogQueries', () => ({
  logFood: jest.fn(),
  fetchTodaysFoodLogs: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockFetchAllFoods = fetchAllFoods as jest.Mock;
const mockFetchRecentFoods = fetchRecentFoods as jest.Mock;
const mockFetchUsualFoods = fetchUsualFoods as jest.Mock;
const mockFetchSavedMeals = fetchSavedMeals as jest.Mock;
const mockCreateSavedMeal = createSavedMeal as jest.Mock;
const mockUpdateSavedMeal = updateSavedMeal as jest.Mock;
const mockDeleteSavedMeal = deleteSavedMeal as jest.Mock;
const mockFetchRecipeIngredients = fetchRecipeIngredients as jest.Mock;
const mockCreateRecipe = createRecipe as jest.Mock;
const mockUpdateRecipe = updateRecipe as jest.Mock;
const mockDeleteRecipe = deleteRecipe as jest.Mock;
const mockCreateFood = createFood as jest.Mock;
const mockUpdateFood = updateFood as jest.Mock;
const mockLogFood = logFood as jest.Mock;
const mockFetchTodaysFoodLogs = fetchTodaysFoodLogs as jest.Mock;
const mockUploadFoodPhoto = uploadFoodPhoto as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockOpenMenu = jest.fn();
const mockDispatch = jest.fn();
// Opened from Nutrition, so Done goes back to that Nutrition page (sectionNavigation.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  dispatch: mockDispatch,
  getState: () => ({ routes: [{ name: 'Nutrition' }, { name: 'FoodLibrary' }] }),
};

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
    <ProfileProvider>
      <FoodLogProvider>
        <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode }}>
          <FoodLibraryScreen navigation={navigation} route={{ params } as never} />
        </AppMenuContext.Provider>
      </FoodLogProvider>
    </ProfileProvider>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, session: { access_token: 'token-1' } });
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockFetchAllFoods.mockReset().mockResolvedValue([apple, banana]);
  mockFetchRecentFoods.mockReset().mockResolvedValue([]);
  mockFetchUsualFoods.mockReset().mockResolvedValue([]);
  mockFetchSavedMeals.mockReset().mockResolvedValue([]);
  mockCreateSavedMeal.mockReset().mockResolvedValue({});
  mockUpdateSavedMeal.mockReset().mockResolvedValue({});
  mockDeleteSavedMeal.mockReset().mockResolvedValue(undefined);
  mockFetchRecipeIngredients.mockReset().mockResolvedValue([]);
  mockCreateRecipe.mockReset().mockResolvedValue({});
  mockUpdateRecipe.mockReset().mockResolvedValue({});
  mockDeleteRecipe.mockReset().mockResolvedValue(undefined);
  mockCreateFood.mockReset();
  mockUpdateFood.mockReset();
  mockLogFood.mockReset();
  mockFetchTodaysFoodLogs.mockReset().mockResolvedValue([]);
  mockUploadFoodPhoto.mockReset();
  mockGoBack.mockClear();
  mockNavigate.mockClear();
  mockDispatch.mockClear();
  mockOpenMenu.mockClear();
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

  it('has no A-Z rail -- a heading only for each letter that has foods', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    expect(screen.queryByTestId('food-library-index')).toBeNull();
    expect(
      screen.getAllByTestId(/^food-library-section-/).map((node) => node.props.testID),
    ).toEqual(['food-library-section-A', 'food-library-section-B']);
    expect(screen.queryByTestId('food-library-section-Z')).toBeNull();
  });

  it('scrolls the letter headings with their foods, rather than pinning them', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    // No heading is one the list pins in place (iOS pins them all by default).
    expect(screen.getByTestId('food-library-list').props.stickyHeaderIndices ?? []).toEqual([]);
  });

  it('opens the app-level side menu from the hamburger button, not a back arrow', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    expect(screen.queryByTestId('app-header-back')).toBeNull();

    fireEvent.press(screen.getByTestId('food-library-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith();
  });

  it('navigates to AI Food Search from the header, next to the create action', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-library-ai-search'));

    expect(mockNavigate).toHaveBeenCalledWith('AiFoodSearch', { day: undefined });
  });

  it('creates a food and returns to the list', async () => {
    mockCreateFood.mockResolvedValue({ ...apple, id: 'food-2', name: 'Cherry' });

    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-food'));
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Cherry');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '150');
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

  it('opens straight into creating a food when reached from the Scan Barcode "not found" fallback, without a barcode field', async () => {
    renderScreen('nutrition', { openCreate: true, barcode: '012345678905' });

    expect(await screen.findByTestId('food-form-name')).toBeTruthy();
    expect(screen.queryByTestId('food-form-barcode')).toBeNull();
  });

  it('carries straight on to logging the food it just created for a scanned barcode', async () => {
    mockCreateFood.mockResolvedValue({
      ...apple,
      id: 'food-scanned',
      name: 'Mystery Bar',
      barcode: '012345678905',
    });
    renderScreen('nutrition', { openCreate: true, barcode: '012345678905' });

    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Mystery Bar');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '40');
    fireEvent.changeText(screen.getByTestId('food-form-calories'), '180');
    fireEvent.changeText(screen.getByTestId('food-form-protein'), '10');
    fireEvent.changeText(screen.getByTestId('food-form-carbs'), '20');
    fireEvent.changeText(screen.getByTestId('food-form-fat'), '6');
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    // Saved with the scanned barcode...
    expect(mockCreateFood).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ name: 'Mystery Bar', barcode: '012345678905' }),
    );
    // ...and now on the log step for that very food, not back at the list.
    expect(await screen.findByTestId('log-food-quantity')).toBeTruthy();
    expect(screen.getByText('Mystery Bar')).toBeTruthy();

    mockLogFood.mockResolvedValue(undefined);
    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
    });
    expect(mockLogFood).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ id: 'food-scanned' }),
      1,
      expect.anything(),
      { amount: 1, unit: 'servings' },
      undefined,
    );
    // Done returns to Nutrition, not back to the scanner's not-found screen.
    expect(mockDispatch).toHaveBeenCalledWith(StackActions.popToTop());
    expect(mockNavigate).not.toHaveBeenCalledWith('Nutrition');
  });

  it('goes back to the list, not to logging, after creating a food the ordinary way', async () => {
    mockCreateFood.mockResolvedValue({ ...apple, id: 'food-3', name: 'Almonds' });
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-food'));
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Almonds');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '28');
    fireEvent.changeText(screen.getByTestId('food-form-calories'), '160');
    fireEvent.changeText(screen.getByTestId('food-form-protein'), '6');
    fireEvent.changeText(screen.getByTestId('food-form-carbs'), '6');
    fireEvent.changeText(screen.getByTestId('food-form-fat'), '14');
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    expect(await screen.findByTestId('food-item-food-apple')).toBeTruthy();
    expect(screen.queryByTestId('log-food-quantity')).toBeNull();
  });

  it("shows a food's photo on its row when it has one, and a glyph when it does not", async () => {
    mockFetchAllFoods.mockResolvedValue([
      { ...apple, imageUrl: 'https://images.example/apple.jpg' },
      { ...banana, imageUrl: null },
    ]);
    renderScreen();

    const withPhoto = await screen.findByTestId('food-item-food-apple');
    expect(within(withPhoto).UNSAFE_getByType(Image).props.source).toEqual({
      uri: 'https://images.example/apple.jpg',
    });
    expect(
      within(screen.getByTestId('food-item-food-banana')).UNSAFE_queryAllByType(Image),
    ).toHaveLength(0);
  });

  it('lets the user add a photo of a custom food, uploading it on save and storing its URL', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Choose from Library')?.onPress?.();
    });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file://food.jpg' }],
    });
    mockUploadFoodPhoto.mockResolvedValue('https://images.example/food.jpg');
    mockCreateFood.mockResolvedValue({ ...apple, id: 'food-3', name: 'Almonds' });
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-food'));
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Almonds');
    expect(screen.getByTestId('food-form-photo-add')).toHaveTextContent('Add Photo');
    fireEvent.press(screen.getByTestId('food-form-photo-add'));
    expect(await screen.findByTestId('food-form-photo-remove')).toBeTruthy();
    expect(screen.getByTestId('food-form-photo-add')).toHaveTextContent('Change Photo');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '28');
    fireEvent.changeText(screen.getByTestId('food-form-calories'), '160');
    fireEvent.changeText(screen.getByTestId('food-form-protein'), '6');
    fireEvent.changeText(screen.getByTestId('food-form-carbs'), '6');
    fireEvent.changeText(screen.getByTestId('food-form-fat'), '14');
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    expect(mockUploadFoodPhoto).toHaveBeenCalledWith('user-1', 'file://food.jpg');
    expect(mockCreateFood).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ imageUrl: 'https://images.example/food.jpg' }),
    );
  });

  it('saves a food with no photo when none was chosen, without touching storage', async () => {
    mockCreateFood.mockResolvedValue({ ...apple, id: 'food-3', name: 'Almonds' });
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-food'));
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Almonds');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '28');
    fireEvent.changeText(screen.getByTestId('food-form-calories'), '160');
    fireEvent.changeText(screen.getByTestId('food-form-protein'), '6');
    fireEvent.changeText(screen.getByTestId('food-form-carbs'), '6');
    fireEvent.changeText(screen.getByTestId('food-form-fat'), '14');
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    expect(mockUploadFoodPhoto).not.toHaveBeenCalled();
    expect(mockCreateFood.mock.calls[0][1]).not.toHaveProperty('imageUrl');
  });

  it('shows the photo an existing food has, and clears it on save when removed', async () => {
    mockFetchAllFoods.mockResolvedValue([
      { ...apple, imageUrl: 'https://images.example/apple.jpg' },
    ]);
    mockUpdateFood.mockResolvedValue(apple);
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-edit-food-apple'));
    fireEvent.press(await screen.findByTestId('food-form-photo-remove'));
    expect(screen.queryByTestId('food-form-photo-remove')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    expect(mockUpdateFood).toHaveBeenCalledWith(
      'food-apple',
      expect.objectContaining({ imageUrl: null }),
    );
  });

  it('creates a food with the optional brand filled in', async () => {
    mockCreateFood.mockResolvedValue({ ...apple, id: 'food-3', name: 'Almonds' });

    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-food'));
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Almonds');
    fireEvent.changeText(screen.getByTestId('food-form-brand'), 'Kirkland');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '28');
    fireEvent.changeText(screen.getByTestId('food-form-calories'), '160');
    fireEvent.changeText(screen.getByTestId('food-form-protein'), '6');
    fireEvent.changeText(screen.getByTestId('food-form-carbs'), '6');
    fireEvent.changeText(screen.getByTestId('food-form-fat'), '14');

    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });

    expect(mockCreateFood).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ brand: 'Kirkland' }),
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
    expect(screen.getByTestId('log-food-calories')).toHaveTextContent(/95/);

    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
    });

    expect(mockLogFood).toHaveBeenCalledWith(
      'user-1',
      apple,
      1,
      // Time-of-day default (see defaultMealTypeForTime) -- any valid meal.
      expect.stringMatching(/^(breakfast|lunch|dinner|snack)$/),
      { amount: 1, unit: 'servings' },
      undefined,
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('scales the preview totals when quantity changes', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-item-food-apple'));
    await screen.findByTestId('log-food-quantity');

    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '2');

    expect(screen.getByTestId('log-food-calories')).toHaveTextContent(/190/);
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

describe('FoodLibraryScreen -- Recent', () => {
  // Logged from Search, so it is not one of the user's own library foods.
  const yogurt = {
    id: 'food-yogurt',
    name: 'Greek Yogurt',
    brand: 'Fage',
    servingSize: 170,
    servingUnit: 'g',
    calories: 100,
    proteinG: 18,
    carbsG: 6,
    fatG: 0,
    isActive: true,
  };

  it('lists the foods logged most recently above the letters, without an edit button', async () => {
    mockFetchRecentFoods.mockResolvedValue([
      { food: yogurt, quantity: 2 },
      { food: apple, quantity: 1 },
    ]);
    renderScreen();

    expect(await screen.findByTestId('food-recent-food-yogurt')).toHaveTextContent(/Greek Yogurt/);
    expect(screen.getByTestId('food-recent-food-apple')).toBeTruthy();
    expect(
      screen.getAllByTestId(/^food-library-section-/).map((node) => node.props.testID),
    ).toEqual(['food-library-section-Recent', 'food-library-section-A', 'food-library-section-B']);
    expect(screen.getByTestId('food-library-section-Recent')).toHaveTextContent('Recent');
    // The library is still listed underneath, and only its own foods can be edited.
    expect(screen.getByTestId('food-item-food-apple')).toBeTruthy();
    expect(screen.queryByTestId('food-edit-food-yogurt')).toBeNull();
    // Enough that Recent keeps its eight once Usual's are taken out.
    expect(mockFetchRecentFoods).toHaveBeenCalledWith('user-1', 14);
  });

  it('re-logs a recent food in two taps, at the quantity logged last time', async () => {
    mockFetchRecentFoods.mockResolvedValue([{ food: yogurt, quantity: 2 }]);
    mockLogFood.mockResolvedValue({});
    renderScreen();

    fireEvent.press(await screen.findByTestId('food-recent-food-yogurt'));
    expect(await screen.findByTestId('log-food-quantity')).toHaveProp('value', '2');
    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
    });

    expect(mockLogFood).toHaveBeenCalledWith(
      'user-1',
      yogurt,
      2,
      expect.stringMatching(/^(breakfast|lunch|dinner|snack)$/),
      { amount: 2, unit: 'servings' },
      undefined,
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('re-reads Recent after a food is edited, so it never logs the older copy', async () => {
    const edited = { ...apple, calories: 100 };
    mockFetchRecentFoods
      .mockResolvedValueOnce([{ food: apple, quantity: 1 }])
      .mockResolvedValue([{ food: edited, quantity: 1 }]);
    mockUpdateFood.mockResolvedValue(edited);
    mockLogFood.mockResolvedValue({});
    renderScreen();
    await screen.findByTestId('food-recent-food-apple');

    fireEvent.press(screen.getByTestId('food-edit-food-apple'));
    fireEvent.changeText(await screen.findByTestId('food-form-calories'), '100');
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('food-recent-food-apple')).toHaveTextContent(/100 cal/),
    );
    fireEvent.press(screen.getByTestId('food-recent-food-apple'));
    await screen.findByTestId('log-food-quantity');
    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
    });

    expect(mockLogFood).toHaveBeenCalledWith(
      'user-1',
      edited,
      1,
      expect.any(String),
      {
        amount: 1,
        unit: 'servings',
      },
      undefined,
    );
  });

  it('hides Recent while searching', async () => {
    mockFetchRecentFoods.mockResolvedValue([{ food: yogurt, quantity: 2 }]);
    renderScreen();
    await screen.findByTestId('food-library-section-Recent');

    fireEvent.changeText(screen.getByTestId('food-search'), 'app');

    await waitFor(() =>
      expect(mockFetchAllFoods).toHaveBeenCalledWith(expect.objectContaining({ search: 'app' })),
    );
    expect(await screen.findByTestId('food-item-food-apple')).toBeTruthy();
    expect(screen.queryByTestId('food-library-section-Recent')).toBeNull();
  });

  it('shows Recent instead of the empty state when the library itself has no foods', async () => {
    mockFetchAllFoods.mockResolvedValue([]);
    mockFetchRecentFoods.mockResolvedValue([{ food: yogurt, quantity: 1 }]);
    renderScreen();

    expect(await screen.findByTestId('food-recent-food-yogurt')).toBeTruthy();
    expect(screen.queryByTestId('food-library-empty')).toBeNull();
  });

  it('still lists the library when Recent cannot load', async () => {
    mockFetchRecentFoods.mockRejectedValue(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('food-item-food-apple')).toBeTruthy();
    expect(screen.queryByTestId('food-library-section-Recent')).toBeNull();
    expect(screen.queryByTestId('food-library-error')).toBeNull();
  });
});

describe('FoodLibraryScreen -- widgets, "+" in the header', () => {
  it('is two widgets (search and count, then the list), and puts a named "+" in the header beside the menu', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(2);
    expect(
      within(screen.getByTestId('food-library-controls')).getByTestId('food-search'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('food-library-list-card')).getByTestId('food-item-food-apple'),
    ).toBeTruthy();
    expect(screen.getByTestId('food-create-button').props.accessibilityLabel).toBe(
      'Add a food, recipe or meal',
    );
    expect(screen.getByText('Food Library')).toBeTruthy();
  });

  it('shows each food as a row: name, serving, calories as a mono value -- with a named 44pt edit button', async () => {
    renderScreen();

    const row = await screen.findByTestId('food-item-food-apple');
    expect(row.props.accessibilityRole).toBe('button');
    expect(row).toHaveTextContent(/Apple/);
    expect(row).toHaveTextContent(/95 cal/);
    const edit = screen.getByTestId('food-edit-food-apple');
    expect(edit.props.accessibilityLabel).toBe('Edit Apple');
    const slop = edit.props.hitSlop as { top: number; bottom: number };
    expect(
      StyleSheet.flatten(edit.props.style).height + slop.top + slop.bottom,
    ).toBeGreaterThanOrEqual(44);
  });

  it('shows sort as a quiet text action, not a bordered pill', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    const sort = screen.getByTestId('food-library-sort');
    expect(sort).toHaveTextContent('Sort A → Z');
    expect(StyleSheet.flatten(sort.props.style).borderWidth).toBeUndefined();
    expect(sort.props.accessibilityLabel).toBe('Toggle sort order');
  });

  it('offers Create a food as the empty state action', async () => {
    mockFetchAllFoods.mockResolvedValue([]);
    renderScreen();

    const create = await screen.findByTestId('food-empty-create');
    expect(create).toHaveTextContent('Create a food');
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(0);
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    expectNoBareText();
  });
});

describe('FoodFormScreen (via Food Library) -- labelled inputs, one primary action', () => {
  it('uses labelled shared inputs and a named Cancel', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');
    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-food'));

    const name = await screen.findByTestId('food-form-name');
    expect(name.props.accessibilityLabel).toBe('Name');
    expect(screen.getByTestId('food-form-serving-size').props.accessibilityLabel).toBe(
      'Serving size',
    );
    expect(screen.getByTestId('food-form-protein').props.accessibilityLabel).toBe('Protein (g)');
    expect(screen.getByTestId('food-form-cancel').props.accessibilityLabel).toBe('Cancel');
    // Details, Serving and Nutrition per serving.
    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(3);
  });

  it('has one filled Save, disabled until the form is valid, and busy while saving', async () => {
    mockCreateFood.mockReturnValue(new Promise(() => undefined));
    renderScreen();
    await screen.findByTestId('food-item-food-apple');
    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-food'));
    await screen.findByTestId('food-form-name');

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    expect(screen.getByTestId('food-form-save').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('food-form-name'), 'Cherry');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '150');
    fireEvent.changeText(screen.getByTestId('food-form-calories'), '50');
    fireEvent.changeText(screen.getByTestId('food-form-protein'), '1');
    fireEvent.changeText(screen.getByTestId('food-form-carbs'), '12');
    fireEvent.changeText(screen.getByTestId('food-form-fat'), '0');
    expect(screen.getByTestId('food-form-save').props.accessibilityState.disabled).toBe(false);

    await act(async () => {
      fireEvent.press(screen.getByTestId('food-form-save'));
    });
    expect(screen.getByTestId('food-form-save').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it('shows Deactivate as a destructive outline beneath Save when editing', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');
    fireEvent.press(screen.getByTestId('food-edit-food-apple'));

    const toggle = await screen.findByTestId('food-form-toggle-active');
    expect(toggle).toHaveTextContent('Deactivate');
    expect(StyleSheet.flatten(toggle.props.style).borderWidth).toBe(1);
    expectNoBareText();
  });
});

describe('FoodLibraryScreen -- Usual', () => {
  const eggs = { ...apple, id: 'food-eggs', name: 'Eggs', servingSize: 100 };

  it('lists the usual foods above Recent, and leaves them out of Recent', async () => {
    mockFetchUsualFoods.mockResolvedValue([{ food: eggs, quantity: 2 }]);
    mockFetchRecentFoods.mockResolvedValue([
      { food: eggs, quantity: 2 },
      { food: banana, quantity: 1 },
    ]);
    renderScreen();

    expect(await screen.findByTestId('food-usual-food-eggs')).toHaveTextContent(/Eggs/);
    expect(
      screen.getAllByTestId(/^food-library-section-/).map((node) => node.props.testID),
    ).toEqual([
      'food-library-section-Usual',
      'food-library-section-Recent',
      'food-library-section-A',
      'food-library-section-B',
    ]);
    expect(screen.queryByTestId('food-recent-food-eggs')).toBeNull();
    expect(screen.getByTestId('food-recent-food-banana')).toBeTruthy();
    expect(screen.queryByTestId('food-edit-food-eggs')).toBeNull();
    expect(mockFetchUsualFoods).toHaveBeenCalledWith('user-1', 6);
  });

  it("opens the log step at last time's amount, as it was typed", async () => {
    mockFetchUsualFoods.mockResolvedValue([
      { food: eggs, quantity: 1.5, entered: { amount: 150, unit: 'g' } },
    ]);
    mockLogFood.mockResolvedValue({});
    renderScreen();

    fireEvent.press(await screen.findByTestId('food-usual-food-eggs'));
    expect(await screen.findByTestId('log-food-quantity')).toHaveProp('value', '150');
    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
    });

    expect(mockLogFood).toHaveBeenCalledWith(
      'user-1',
      eggs,
      1.5,
      expect.any(String),
      {
        amount: 150,
        unit: 'g',
      },
      undefined,
    );
  });

  it('still lists the library when Usual cannot load', async () => {
    mockFetchUsualFoods.mockRejectedValue(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('food-item-food-apple')).toBeTruthy();
    expect(screen.queryByTestId('food-library-section-Usual')).toBeNull();
    expect(screen.queryByTestId('food-library-error')).toBeNull();
  });
});

describe('FoodLibraryScreen -- the "+" menu', () => {
  it('offers a new food, a new recipe or a new meal', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-create-button'));

    expect(screen.getByTestId('food-library-add-food')).toHaveTextContent(/New Food/);
    expect(screen.getByTestId('food-library-add-recipe')).toHaveTextContent(/New Recipe/);
    expect(screen.getByTestId('food-library-add-meal')).toHaveTextContent(/New Meal/);

    fireEvent.press(screen.getByTestId('food-library-add-recipe'));
    expect(await screen.findByText('New Recipe')).toBeTruthy();
    expect(screen.getByTestId('food-group-servings')).toBeTruthy();
  });
});

describe('FoodLibraryScreen -- Saved Meals', () => {
  const breakfast = {
    id: 'meal-1',
    name: 'Breakfast',
    items: [
      { food: apple, quantity: 2, entered: null },
      { food: banana, quantity: 1, entered: { amount: 118, unit: 'g' as const } },
      // Taken out of the library since: not logged, not counted.
      {
        food: { ...apple, id: 'food-gone', name: 'Old Granola', isActive: false },
        quantity: 1,
        entered: null,
      },
    ],
  };

  it('lists saved meals first, each with its foods and calories', async () => {
    mockFetchSavedMeals.mockResolvedValue([breakfast]);
    renderScreen();

    const row = await screen.findByTestId('food-meal-meal-1');
    expect(row).toHaveTextContent(/Breakfast/);
    expect(row).toHaveTextContent(/3 foods/);
    // 2 x 95 + 105.
    expect(row).toHaveTextContent(/295 cal/);
    expect(screen.getAllByTestId(/^food-library-section-/)[0]).toHaveTextContent('Saved Meals');
  });

  it('finds saved meals by name while searching', async () => {
    mockFetchSavedMeals.mockResolvedValue([
      breakfast,
      { ...breakfast, id: 'meal-2', name: 'Lunch' },
    ]);
    renderScreen();
    await screen.findByTestId('food-meal-meal-1');

    fireEvent.changeText(screen.getByTestId('food-search'), 'lun');

    await waitFor(() =>
      expect(mockFetchAllFoods).toHaveBeenCalledWith(expect.objectContaining({ search: 'lun' })),
    );
    expect(await screen.findByTestId('food-meal-meal-2')).toBeTruthy();
    expect(screen.queryByTestId('food-meal-meal-1')).toBeNull();
  });

  it("shows a saved meal's foods, and logs each one still in the library as its own entry", async () => {
    mockFetchSavedMeals.mockResolvedValue([breakfast]);
    mockLogFood.mockImplementation(async (_user, food, quantity) => ({
      id: `log-${food.id}`,
      foodId: food.id,
      foodNameSnapshot: food.name,
      quantity,
      calories: food.calories * quantity,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      mealType: 'breakfast',
      loggedAt: new Date().toISOString(),
    }));
    renderScreen();

    fireEvent.press(await screen.findByTestId('food-meal-meal-1'));
    expect(screen.getByTestId('food-meal-sheet-summary')).toHaveTextContent('2 foods · 295 cal');
    expect(screen.getByTestId('food-meal-sheet-item-1')).toHaveTextContent(/118 g/);
    expect(screen.getByTestId('food-meal-sheet-item-2')).toHaveTextContent(
      /No longer in your library/,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('food-meal-log'));
    });

    expect(mockLogFood).toHaveBeenCalledTimes(2);
    expect(mockLogFood).toHaveBeenNthCalledWith(
      1,
      'user-1',
      apple,
      2,
      expect.any(String),
      null,
      undefined,
    );
    expect(mockLogFood).toHaveBeenNthCalledWith(
      2,
      'user-1',
      banana,
      1,
      expect.any(String),
      { amount: 118, unit: 'g' },
      undefined,
    );
    // On to Today, where they now are.
    expect(mockDispatch).toHaveBeenCalledWith(StackActions.popToTop());
  });

  it('opens a saved meal to edit it', async () => {
    mockFetchSavedMeals.mockResolvedValue([breakfast]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('food-meal-meal-1'));
    fireEvent.press(screen.getByTestId('food-meal-edit'));

    expect(await screen.findByText('Edit Meal')).toBeTruthy();
    expect(screen.getByTestId('food-group-name')).toHaveProp('value', 'Breakfast');
    expect(screen.getByTestId('food-group-item-0')).toHaveTextContent(/Apple/);
  });
});

describe('FoodLibraryScreen -- building a meal or a recipe', () => {
  async function addFood(testID: string, amount?: string) {
    fireEvent.press(screen.getByTestId('food-group-add'));
    fireEvent.press(await screen.findByTestId(testID));
    if (amount !== undefined) {
      fireEvent.changeText(await screen.findByTestId('log-food-quantity'), amount);
    }
    fireEvent.press(await screen.findByTestId('log-food-submit'));
    await screen.findByTestId('food-group-save');
  }

  it('builds a saved meal from foods picked with their amounts', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');
    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-meal'));

    expect(await screen.findByText('New Meal')).toBeTruthy();
    expect(screen.getByTestId('food-group-save').props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByTestId('food-group-name'), 'Snack Plate');
    await addFood('food-picker-own-food-apple', '2');
    await addFood('food-picker-own-food-banana');

    expect(screen.getByTestId('food-group-item-0')).toHaveTextContent(/Apple/);
    expect(screen.getByTestId('food-group-calories')).toHaveTextContent(/295/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-group-save'));
    });

    expect(mockCreateSavedMeal).toHaveBeenCalledWith('user-1', 'Snack Plate', [
      { food: apple, quantity: 2, entered: { amount: 2, unit: 'servings' } },
      { food: banana, quantity: 1, entered: { amount: 1, unit: 'servings' } },
    ]);
    // Back on the list, read again.
    expect(await screen.findByTestId('food-item-food-apple')).toBeTruthy();
    expect(mockFetchSavedMeals).toHaveBeenCalledTimes(2);
  });

  it('changes an amount, or takes a food out, before saving', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');
    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-meal'));
    await screen.findByTestId('food-group-name');
    await addFood('food-picker-own-food-apple');
    await addFood('food-picker-own-food-banana');

    fireEvent.press(screen.getByTestId('food-group-item-0'));
    expect(await screen.findByTestId('log-food-submit')).toHaveTextContent('Update');
    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '3');
    fireEvent.press(screen.getByTestId('log-food-submit'));
    await screen.findByTestId('food-group-save');
    fireEvent.press(screen.getByTestId('food-group-remove-1'));

    expect(screen.getByTestId('food-group-item-0')).toHaveTextContent(/3 servings/);
    expect(screen.queryByTestId('food-group-item-1')).toBeNull();
    expect(screen.getByTestId('food-group-calories')).toHaveTextContent(/285/);
  });

  it('builds a recipe: its figures per serving are the ingredients divided by the servings', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');
    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-recipe'));

    fireEvent.changeText(await screen.findByTestId('food-group-name'), 'Fruit Smoothie');
    fireEvent.changeText(screen.getByTestId('food-group-servings'), '2');
    await addFood('food-picker-own-food-apple');
    await addFood('food-picker-own-food-banana');

    // (95 + 105) / 2.
    expect(screen.getByTestId('food-group-calories')).toHaveTextContent(/100/);
    expect(screen.getByTestId('food-group-batch')).toHaveTextContent('Whole recipe: 200 cal');
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-group-save'));
    });

    expect(mockCreateRecipe).toHaveBeenCalledWith('user-1', {
      name: 'Fruit Smoothie',
      servings: 2,
      ingredients: [
        expect.objectContaining({ food: apple, quantity: 1 }),
        expect.objectContaining({ food: banana, quantity: 1 }),
      ],
    });
  });

  it('shows a recipe in the library as one food, and its pencil opens the recipe', async () => {
    const smoothie = {
      ...apple,
      id: 'food-smoothie',
      name: 'Smoothie',
      servingSize: 1,
      servingUnit: 'serving',
      calories: 100,
      recipeServings: 2,
    };
    mockFetchAllFoods.mockResolvedValue([apple, smoothie]);
    mockFetchRecipeIngredients.mockResolvedValue([
      { food: apple, quantity: 1, entered: null },
      { food: banana, quantity: 1, entered: null },
    ]);
    renderScreen();

    expect(await screen.findByTestId('food-item-food-smoothie')).toHaveTextContent(
      /Recipe · 1 serving/,
    );
    fireEvent.press(screen.getByTestId('food-edit-food-smoothie'));

    expect(await screen.findByText('Edit Recipe')).toBeTruthy();
    expect(mockFetchRecipeIngredients).toHaveBeenCalledWith('food-smoothie');
    expect(await screen.findByTestId('food-group-item-1')).toHaveTextContent(/Banana/);
    expect(screen.getByTestId('food-group-servings')).toHaveProp('value', '2');
  });

  it('finds any food through Food Search once two letters are typed', async () => {
    const mockSearchFoods = searchFoods as jest.Mock;
    mockSearchFoods.mockReset().mockResolvedValue({
      foods: [
        {
          id: 'food-milk',
          name: 'Whole Milk',
          brand: 'Dairyland',
          imageUrl: null,
          servingSize: 250,
          servingUnit: 'ml',
          calories: 150,
          proteinG: 8,
          carbsG: 12,
          // Not reported by the provider.
          fatG: null,
          provider: 'open_food_facts',
          barcode: null,
        },
      ],
      hasMore: false,
    });
    renderScreen();
    await screen.findByTestId('food-item-food-apple');
    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.press(screen.getByTestId('food-library-add-recipe'));
    fireEvent.changeText(await screen.findByTestId('food-group-name'), 'Latte');
    fireEvent.press(screen.getByTestId('food-group-add'));

    fireEvent.changeText(await screen.findByTestId('food-picker-search'), 'milk');
    fireEvent.press(await screen.findByTestId('food-picker-all-food-milk'));
    fireEvent.press(await screen.findByTestId('log-food-submit'));
    await screen.findByTestId('food-group-save');
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-group-save'));
    });

    expect(mockSearchFoods).toHaveBeenCalledWith('token-1', 'milk');
    expect(mockCreateRecipe).toHaveBeenCalledWith('user-1', {
      name: 'Latte',
      servings: 1,
      ingredients: [
        expect.objectContaining({
          food: expect.objectContaining({ id: 'food-milk', fatG: 0 }),
          quantity: 1,
        }),
      ],
    });
  });

  it('keeps a recipe out of its own ingredients', async () => {
    const smoothie = { ...apple, id: 'food-smoothie', name: 'Smoothie', recipeServings: 1 };
    mockFetchAllFoods.mockResolvedValue([apple, smoothie]);
    mockFetchRecipeIngredients.mockResolvedValue([{ food: apple, quantity: 1, entered: null }]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('food-edit-food-smoothie'));
    await screen.findByTestId('food-group-item-0');
    fireEvent.press(screen.getByTestId('food-group-add'));

    expect(await screen.findByTestId('food-picker-own-food-apple')).toBeTruthy();
    expect(screen.queryByTestId('food-picker-own-food-smoothie')).toBeNull();
  });

  it('deletes a saved meal after asking', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete Meal')?.onPress?.();
    });
    mockFetchSavedMeals.mockResolvedValue([
      { id: 'meal-1', name: 'Breakfast', items: [{ food: apple, quantity: 1, entered: null }] },
    ]);
    renderScreen();
    fireEvent.press(await screen.findByTestId('food-meal-meal-1'));
    fireEvent.press(screen.getByTestId('food-meal-edit'));

    const remove = await screen.findByTestId('food-group-delete');
    await act(async () => {
      fireEvent.press(remove);
    });

    expect(mockDeleteSavedMeal).toHaveBeenCalledWith('meal-1');
    expect(await screen.findByTestId('food-item-food-apple')).toBeTruthy();
  });
});
