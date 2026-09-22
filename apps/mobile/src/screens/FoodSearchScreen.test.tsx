import { Image, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { fonts } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, searchFoods } from '../lib/api';
import { logFood } from '../nutrition/foodLogQueries';
import { FoodSearchScreen } from './FoodSearchScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  searchFoods: jest.fn(),
}));

jest.mock('../nutrition/foodLogQueries', () => ({
  logFood: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockSearchFoods = searchFoods as jest.Mock;
const mockLogFood = logFood as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: mockNavigate };
const route = {} as never;

const chickenBreast = {
  id: 'food-1',
  name: 'Chicken Breast (cooked)',
  brand: null,
  servingSize: 100,
  servingUnit: 'g',
  calories: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
  provider: null,
  barcode: null,
};

const oreoOriginal = {
  id: 'food-2',
  name: 'Oreo Original',
  brand: 'Oreo',
  servingSize: 34,
  servingUnit: 'g',
  calories: 160,
  proteinG: 1.6,
  carbsG: 25,
  fatG: null,
  provider: 'open_food_facts',
  barcode: '0066721016123',
  imageUrl: 'https://images.example/oreo-front.jpg',
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

async function typeSearch(text: string) {
  fireEvent.changeText(screen.getByTestId('food-search-input'), text);
  await act(async () => {
    jest.advanceTimersByTime(300);
    await Promise.resolve();
  });
}

// Flushes the profile-fetch effect (used only to load the nutrition accent
// theme) that every render kicks off, so its state update doesn't land
// outside of act() in tests that otherwise make only synchronous
// assertions right after render.
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockSearchFoods.mockReset().mockResolvedValue({ foods: [chickenBreast], hasMore: false });
  mockLogFood.mockReset();
  mockGoBack.mockClear();
  mockNavigate.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('FoodSearchScreen', () => {
  it('shows an initial prompt before anything has been searched', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />);
    await flush();

    expect(screen.getByTestId('food-search-empty-initial')).toBeTruthy();
    expect(mockSearchFoods).not.toHaveBeenCalled();
  });

  it('debounces input and searches via the backend (real branded + generic foods)', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />);

    await typeSearch('chicken');

    expect(mockSearchFoods).toHaveBeenCalledWith('token-123', 'chicken');
    expect(await screen.findByTestId('food-search-result-food-1')).toHaveTextContent(
      /Chicken Breast/,
    );
  });

  it('searches and displays a real branded grocery product', async () => {
    mockSearchFoods.mockResolvedValue({ foods: [oreoOriginal], hasMore: false });
    render(<FoodSearchScreen navigation={navigation} route={route} />);

    await typeSearch('oreo');

    const row = await screen.findByTestId('food-search-result-food-2');
    expect(row).toHaveTextContent(/Oreo Original/);
    expect(row).toHaveTextContent(/Oreo/);
  });

  it('shows an empty state when no foods match', async () => {
    mockSearchFoods.mockResolvedValue({ foods: [], hasMore: false });
    render(<FoodSearchScreen navigation={navigation} route={route} />);

    await typeSearch('zzz');

    expect(screen.getByTestId('food-search-empty-results')).toHaveTextContent(
      'No foods found for "zzz"',
    );
  });

  it('shows an error state with a working retry', async () => {
    mockSearchFoods.mockRejectedValueOnce(new Error('network error'));
    render(<FoodSearchScreen navigation={navigation} route={route} />);

    await typeSearch('chicken');

    expect(screen.getByTestId('food-search-error')).toHaveTextContent('network error');

    mockSearchFoods.mockResolvedValueOnce({ foods: [chickenBreast], hasMore: false });
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-search-error-retry'));
      await Promise.resolve();
    });

    expect(await screen.findByTestId('food-search-result-food-1')).toBeTruthy();
  });

  it('selecting a result shows its nutrition info and serving size', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />);

    await typeSearch('chicken');
    fireEvent.press(await screen.findByTestId('food-search-result-food-1'));

    expect(screen.getByTestId('food-search-detail-serving')).toHaveTextContent(/100 g/);
    expect(screen.getByTestId('food-search-detail-calories')).toHaveTextContent(/165/);
    expect(screen.getByTestId('food-search-detail-protein')).toHaveTextContent(/31/);
    expect(screen.getByTestId('food-search-detail-carbs')).toHaveTextContent(/0/);
    expect(screen.getByTestId('food-search-detail-fat')).toHaveTextContent(/3\.6/);
  });

  it('shows a dash (never a fabricated 0) for a macro the provider did not report', async () => {
    mockSearchFoods.mockResolvedValue({ foods: [oreoOriginal], hasMore: false });
    render(<FoodSearchScreen navigation={navigation} route={route} />);

    await typeSearch('oreo');
    fireEvent.press(await screen.findByTestId('food-search-result-food-2'));

    expect(screen.getByTestId('food-search-detail-fat')).toHaveTextContent('—');
  });

  it('credits Open Food Facts on the detail view for a branded product, never on generic foods', async () => {
    mockSearchFoods.mockResolvedValue({ foods: [oreoOriginal, chickenBreast], hasMore: false });
    render(<FoodSearchScreen navigation={navigation} route={route} />);
    await typeSearch('food');

    fireEvent.press(await screen.findByTestId('food-search-result-food-2'));
    expect(screen.getByTestId('food-search-detail-attribution')).toHaveTextContent(
      /Open Food Facts/,
    );

    fireEvent.press(screen.getByTestId('app-header-back'));
    fireEvent.press(screen.getByTestId('food-search-result-food-1'));
    expect(screen.queryByTestId('food-search-detail-attribution')).toBeNull();
  });

  it('returns from the detail view back to the results list', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />);

    await typeSearch('chicken');
    fireEvent.press(await screen.findByTestId('food-search-result-food-1'));
    expect(screen.getByTestId('food-search-detail-header')).toBeTruthy();

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(screen.getByTestId('food-search-result-food-1')).toBeTruthy();
  });

  it('goes back when Back is pressed on the search screen', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />);
    await flush();

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('logs a food from a search result via the shared LogFoodStep, then navigates to the daily log', async () => {
    mockLogFood.mockResolvedValue({});
    render(<FoodSearchScreen navigation={navigation} route={route} />);

    await typeSearch('chicken');
    fireEvent.press(await screen.findByTestId('food-search-result-food-1'));
    fireEvent.press(screen.getByTestId('food-search-log-button'));

    expect(await screen.findByTestId('log-food-quantity')).toHaveProp('value', '1');

    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
    });

    expect(mockLogFood).toHaveBeenCalledWith(
      'user-1',
      {
        id: 'food-1',
        name: 'Chicken Breast (cooked)',
        servingSize: 100,
        servingUnit: 'g',
        calories: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
      },
      1,
      // Time-of-day default (see defaultMealTypeForTime) -- any valid meal.
      expect.stringMatching(/^(breakfast|lunch|dinner|snack)$/),
    );
    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('logs a macro the provider did not report as 0 (never fabricated for display, but food_logs requires a real number)', async () => {
    mockSearchFoods.mockResolvedValue({ foods: [oreoOriginal], hasMore: false });
    mockLogFood.mockResolvedValue({});
    render(<FoodSearchScreen navigation={navigation} route={route} />);

    await typeSearch('oreo');
    fireEvent.press(await screen.findByTestId('food-search-result-food-2'));
    fireEvent.press(screen.getByTestId('food-search-log-button'));
    await screen.findByTestId('log-food-quantity');

    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
    });

    expect(mockLogFood).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ fatG: 0 }),
      1,
      expect.stringMatching(/^(breakfast|lunch|dinner|snack)$/),
    );
  });

  it('cancelling the log step returns to the detail view, not all the way to results', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />);

    await typeSearch('chicken');
    fireEvent.press(await screen.findByTestId('food-search-result-food-1'));
    fireEvent.press(screen.getByTestId('food-search-log-button'));
    await screen.findByTestId('log-food-quantity');

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(screen.getByTestId('food-search-detail-header')).toBeTruthy();
  });
});

describe('FoodSearchScreen -- rows, shared nutrition view, one primary action', () => {
  async function searchTwo() {
    mockSearchFoods.mockResolvedValue({ foods: [chickenBreast, oreoOriginal], hasMore: false });
    render(<FoodSearchScreen navigation={navigation} route={route} />);
    await typeSearch('food');
    await screen.findByTestId('food-search-result-food-2');
  }

  it('shows results as rows in one widget: name, brand · serving, calories as a mono value', async () => {
    await searchTwo();

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(1);
    const row = screen.getByTestId('food-search-result-food-2');
    expect(row.props.accessibilityRole).toBe('button');
    expect(row).toHaveTextContent(/Oreo Original/);
    expect(row).toHaveTextContent(/Oreo · 34 g/);
    expect(row).toHaveTextContent(/160 cal/);
  });

  it("shows each result's photo when it has one, and a category glyph when it does not", async () => {
    await searchTwo();

    const withPhoto = within(screen.getByTestId('food-search-result-food-2'));
    expect(withPhoto.UNSAFE_getByType(Image).props.source).toEqual({
      uri: 'https://images.example/oreo-front.jpg',
    });
    expect(
      within(screen.getByTestId('food-search-result-food-1')).UNSAFE_queryAllByType(Image),
    ).toHaveLength(0);
  });

  it('separates result rows with a hairline, none above the first', async () => {
    await searchTwo();

    const first = StyleSheet.flatten(screen.getByTestId('food-search-result-food-1').props.style);
    const second = StyleSheet.flatten(screen.getByTestId('food-search-result-food-2').props.style);
    expect(first.borderTopWidth).toBeUndefined();
    expect(second.borderTopWidth).toBe(StyleSheet.hairlineWidth);
  });

  it('shows the detail with calories as the accent mono readout and exactly one filled button', async () => {
    await searchTwo();
    fireEvent.press(screen.getByTestId('food-search-result-food-1'));

    const calories = StyleSheet.flatten(
      (await screen.findByTestId('food-search-detail-calories')).props.style,
    );
    expect(calories.fontFamily).toBe(fonts.monoBold);
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    // Hero (picture, serving, calories) and macros.
    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(2);
  });

  it('labels the Log Food step: named quantity field, one filled button that reports busy', async () => {
    await searchTwo();
    fireEvent.press(screen.getByTestId('food-search-result-food-1'));
    fireEvent.press(await screen.findByTestId('food-search-log-button'));

    expect((await screen.findByTestId('log-food-quantity')).props.accessibilityLabel).toBe(
      'Quantity',
    );
    mockLogFood.mockReturnValue(new Promise(() => undefined));
    await act(async () => {
      fireEvent.press(screen.getByTestId('log-food-submit'));
      await Promise.resolve();
    });

    expect(screen.getByTestId('log-food-submit').props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it('renders no bare text outside <Text> on the results, the detail or the log step', async () => {
    await searchTwo();
    expectNoBareText();
    fireEvent.press(screen.getByTestId('food-search-result-food-2'));
    await screen.findByTestId('food-search-detail-card');
    expectNoBareText();
    fireEvent.press(screen.getByTestId('food-search-log-button'));
    await screen.findByTestId('log-food-quantity');
    expectNoBareText();
  });
});
