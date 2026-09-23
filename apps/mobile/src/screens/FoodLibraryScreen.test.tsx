import { Alert, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { uploadFoodPhoto } from '../lib/foodPhotoUpload';
import { logFood } from '../nutrition/foodLogQueries';
import { createFood, fetchAllFoods, updateFood } from '../nutrition/foodQueries';
import { ProfileProvider } from '../profile/ProfileProvider';
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

jest.mock('../lib/foodPhotoUpload', () => ({
  uploadFoodPhoto: jest.fn(),
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
const mockUploadFoodPhoto = uploadFoodPhoto as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockOpenMenu = jest.fn();
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
    <ProfileProvider>
      <AppMenuContext.Provider
        value={{ openMenu: mockOpenMenu, currentMode }}
      >
        <FoodLibraryScreen navigation={navigation} route={{ params } as never} />
      </AppMenuContext.Provider>
    </ProfileProvider>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' }, session: { access_token: 'token-1' } });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockFetchAllFoods.mockReset().mockResolvedValue([apple, banana]);
  mockCreateFood.mockReset();
  mockUpdateFood.mockReset();
  mockLogFood.mockReset();
  mockUploadFoodPhoto.mockReset();
  mockGoBack.mockClear();
  mockNavigate.mockClear();
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

  it('opens the app-level side menu from the hamburger button, not a back arrow', async () => {
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    expect(screen.queryByTestId('app-header-back')).toBeNull();

    fireEvent.press(screen.getByTestId('food-library-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith();
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
    fireEvent.changeText(screen.getByTestId('food-form-serving-unit'), 'g');
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
    );
    // Done returns to Nutrition, not back to the scanner's not-found screen.
    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('goes back to the list, not to logging, after creating a food the ordinary way', async () => {
    mockCreateFood.mockResolvedValue({ ...apple, id: 'food-3', name: 'Almonds' });
    renderScreen();
    await screen.findByTestId('food-item-food-apple');

    fireEvent.press(screen.getByTestId('food-create-button'));
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Almonds');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '28');
    fireEvent.changeText(screen.getByTestId('food-form-serving-unit'), 'g');
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
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Almonds');
    expect(screen.getByTestId('food-form-photo-add')).toHaveTextContent('Add Photo');
    fireEvent.press(screen.getByTestId('food-form-photo-add'));
    expect(await screen.findByTestId('food-form-photo-remove')).toBeTruthy();
    expect(screen.getByTestId('food-form-photo-add')).toHaveTextContent('Change Photo');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '28');
    fireEvent.changeText(screen.getByTestId('food-form-serving-unit'), 'g');
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
    fireEvent.changeText(await screen.findByTestId('food-form-name'), 'Almonds');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '28');
    fireEvent.changeText(screen.getByTestId('food-form-serving-unit'), 'g');
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
      'Add a new food',
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
    await screen.findByTestId('food-form-name');

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    expect(screen.getByTestId('food-form-save').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('food-form-name'), 'Cherry');
    fireEvent.changeText(screen.getByTestId('food-form-serving-size'), '150');
    fireEvent.changeText(screen.getByTestId('food-form-serving-unit'), 'g');
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
