import { StackActions } from '@react-navigation/native';
import type { PropsWithChildren } from 'react';
import { Image, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { fonts } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { searchFoods } from '../lib/api';
import { fetchTodaysFoodLogs, logFood } from '../nutrition/foodLogQueries';
import { FoodLogProvider } from '../nutrition/FoodLogProvider';
import { forgetSearches } from '../nutrition/foodSearchMemory';
import { ProfileProvider } from '../profile/ProfileProvider';
import { FoodSearchScreen } from './FoodSearchScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  searchFoods: jest.fn(),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

// The shared food log keeps a logged food in the library first (foodQueries.keepInLibrary);
// here there's nothing to copy, so each food is logged as it is.
jest.mock('../nutrition/foodQueries', () => ({
  keepInLibrary: jest.fn().mockResolvedValue(null),
  createFood: jest.fn(),
  USER_ENTERED: { confidence: 'user_entered' },
}));
jest.mock('../nutrition/foodLogQueries', () => ({
  logFood: jest.fn(),
  fetchTodaysFoodLogs: jest.fn(),
}));

function TestProviders({ children }: PropsWithChildren) {
  return (
    <ProfileProvider>
      <FoodLogProvider>{children}</FoodLogProvider>
    </ProfileProvider>
  );
}

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockSearchFoods = searchFoods as jest.Mock;
const mockLogFood = logFood as jest.Mock;
const mockFetchTodaysFoodLogs = fetchTodaysFoodLogs as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
// Opened from Nutrition, so Done goes back to that Nutrition page (sectionNavigation.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  dispatch: mockDispatch,
  getState: () => ({ routes: [{ name: 'Nutrition' }, { name: 'FoodSearch' }] }),
};
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
  // Every test searches afresh: nothing remembered from the one before.
  forgetSearches();
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockSearchFoods.mockReset().mockResolvedValue({ foods: [chickenBreast], hasMore: false });
  mockLogFood.mockReset();
  mockFetchTodaysFoodLogs.mockReset().mockResolvedValue([]);
  mockGoBack.mockClear();
  mockNavigate.mockClear();
  mockDispatch.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('FoodSearchScreen', () => {
  it('shows an initial prompt before anything has been searched', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });
    await flush();

    expect(screen.getByTestId('food-search-empty-initial')).toBeTruthy();
    expect(mockSearchFoods).not.toHaveBeenCalled();
  });

  it('debounces input and searches via the backend (real branded + generic foods)', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('chicken');

    expect(mockSearchFoods).toHaveBeenCalledWith('token-123', 'chicken');
    expect(await screen.findByTestId('food-search-result-food-1')).toHaveTextContent(
      /Chicken Breast/,
    );
  });

  it('shows a search already answered at once, asking nothing again', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });
    await typeSearch('chicken');
    await screen.findByTestId('food-search-result-food-1');
    const asked = mockSearchFoods.mock.calls.length;

    await typeSearch('');
    await typeSearch('chicken');

    expect(screen.getByTestId('food-search-result-food-1')).toBeTruthy();
    expect(mockSearchFoods).toHaveBeenCalledTimes(asked);
    expect(screen.queryByTestId('food-search-finding-more')).toBeNull();
  });

  it('narrows what is on screen as the search is typed on, while the new answer comes', async () => {
    let answer: (value: unknown) => void = () => undefined;
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });
    await typeSearch('chicken');
    await screen.findByTestId('food-search-result-food-1');

    mockSearchFoods.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    await typeSearch('chicken bre');
    // Still a match, before anything has come back.
    expect(screen.getByTestId('food-search-result-food-1')).toBeTruthy();
    await typeSearch('chicken thigh');
    expect(screen.queryByTestId('food-search-result-food-1')).toBeNull();
    await act(async () => answer({ foods: [], hasMore: false }));
  });

  it('searches and displays a real branded grocery product', async () => {
    mockSearchFoods.mockResolvedValue({ foods: [oreoOriginal], hasMore: false });
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('oreo');

    const row = await screen.findByTestId('food-search-result-food-2');
    expect(row).toHaveTextContent(/Oreo Original/);
    expect(row).toHaveTextContent(/Oreo/);
  });

  it('shows an empty state when no foods match', async () => {
    mockSearchFoods.mockResolvedValue({ foods: [], hasMore: false });
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('zzz');

    expect(screen.getByTestId('food-search-empty-results')).toHaveTextContent(
      /No foods found for "zzz"/,
    );
    // The other ways in, for a food no database has.
    fireEvent.press(screen.getByTestId('food-search-try-ai'));
    expect(mockNavigate).toHaveBeenCalledWith('AiFoodSearch', { day: undefined });
    fireEvent.press(screen.getByTestId('food-search-enter-own'));
    expect(mockNavigate).toHaveBeenCalledWith('QuickFoodEntry', { day: undefined });
  });

  it('shows an error state with a working retry', async () => {
    // Both the quick answer and the full one fail.
    mockSearchFoods
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('network error'));
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('chicken');

    expect(screen.getByTestId('food-search-error')).toHaveTextContent('network error');

    mockSearchFoods.mockResolvedValue({ foods: [chickenBreast], hasMore: false });
    await act(async () => {
      fireEvent.press(screen.getByTestId('food-search-error-retry'));
      await Promise.resolve();
    });

    expect(await screen.findByTestId('food-search-result-food-1')).toBeTruthy();
  });

  it('selecting a result shows its nutrition info and serving size', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('chicken');
    fireEvent.press(await screen.findByTestId('food-search-result-food-1'));

    expect(screen.getByTestId('food-search-detail-serving')).toHaveTextContent(/100 g/);
    expect(screen.getByTestId('food-search-detail-calories')).toHaveTextContent(/165/);
    expect(screen.getByTestId('food-search-detail-protein')).toHaveTextContent(/31/);
    expect(screen.getByTestId('food-search-detail-carbs')).toHaveTextContent(/0/);
    // 3.6 g of fat, rounded down to the gram.
    expect(screen.getByTestId('food-search-detail-fat')).toHaveTextContent('3g');
  });

  it('shows a dash (never a fabricated 0) for a macro the provider did not report', async () => {
    mockSearchFoods.mockResolvedValue({ foods: [oreoOriginal], hasMore: false });
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('oreo');
    fireEvent.press(await screen.findByTestId('food-search-result-food-2'));

    expect(screen.getByTestId('food-search-detail-fat')).toHaveTextContent('—');
  });

  it('credits Open Food Facts on the detail view for a branded product, never on generic foods', async () => {
    mockSearchFoods.mockResolvedValue({ foods: [oreoOriginal, chickenBreast], hasMore: false });
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });
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
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('chicken');
    fireEvent.press(await screen.findByTestId('food-search-result-food-1'));
    expect(screen.getByTestId('food-search-detail-header')).toBeTruthy();

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(screen.getByTestId('food-search-result-food-1')).toBeTruthy();
  });

  it('closes when Close is pressed on the search screen', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });
    await flush();

    expect(screen.getByTestId('food-search-close').props.accessibilityLabel).toBe('Close');
    fireEvent.press(screen.getByTestId('food-search-close'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('logs a food from a search result via the shared LogFoodStep, then navigates to the daily log', async () => {
    mockLogFood.mockResolvedValue({});
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

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
        provider: null,
      },
      1,
      // Time-of-day default (see defaultMealTypeForTime) -- any valid meal.
      expect.stringMatching(/^(breakfast|lunch|dinner|snack)$/),
      { amount: 1, unit: 'servings' },
      undefined,
    );
    expect(mockDispatch).toHaveBeenCalledWith(StackActions.popToTop());
    expect(mockNavigate).not.toHaveBeenCalledWith('Nutrition');
  });

  it('logs a macro the provider did not report as 0 (never fabricated for display, but food_logs requires a real number)', async () => {
    mockSearchFoods.mockResolvedValue({ foods: [oreoOriginal], hasMore: false });
    mockLogFood.mockResolvedValue({});
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

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
      { amount: 1, unit: 'servings' },
      undefined,
    );
  });

  it('cancelling the log step returns to the detail view, not all the way to results', async () => {
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

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
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });
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
    // Hero (picture, serving, calories), macros, and its vitamins and minerals.
    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(3);
    expect(screen.getByTestId('food-search-detail-nutrients')).toHaveTextContent(
      /Vitamins & Minerals/,
    );
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

describe('FoodSearchScreen: quick results first, the latest search only', () => {
  const onionsRaw = {
    ...chickenBreast,
    id: 'food-onion',
    name: 'Onions, raw',
    calories: 40,
    provider: 'usda_fdc',
    servingLabel: '100 g · 1 medium ≈ 110 g',
  };

  /** A search answer that waits until it's let go. */
  function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    let reject: (error: Error) => void = () => {};
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it('shows the quick answer at once, then the full one with branded products', async () => {
    const quick = deferred<unknown>();
    const full = deferred<unknown>();
    mockSearchFoods.mockImplementation(
      (
        _token: string,
        _query: string,
        _page?: number,
        _size?: number,
        options?: { branded?: boolean },
      ) => (options?.branded === false ? quick.promise : full.promise),
    );
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('onion');
    expect(mockSearchFoods).toHaveBeenCalledWith('token-123', 'onion', 0, 30, { branded: false });
    expect(mockSearchFoods).toHaveBeenCalledWith('token-123', 'onion');

    await act(async () => {
      quick.resolve({ foods: [onionsRaw], hasMore: false });
    });
    expect(screen.getByTestId('food-search-result-food-onion')).toHaveTextContent(/USDA · 100 g/);
    expect(screen.getByTestId('food-search-finding-more')).toHaveTextContent(
      'Looking for branded products…',
    );

    await act(async () => {
      full.resolve({ foods: [onionsRaw, oreoOriginal], hasMore: false });
    });
    expect(screen.getByTestId('food-search-result-food-2')).toBeTruthy();
    expect(screen.queryByTestId('food-search-finding-more')).toBeNull();
  });

  it('keeps the quick answer, and offers to try again, when the branded products fail', async () => {
    mockSearchFoods.mockImplementation(
      (
        _token: string,
        _query: string,
        _page?: number,
        _size?: number,
        options?: { branded?: boolean },
      ) =>
        options?.branded === false
          ? Promise.resolve({ foods: [onionsRaw], hasMore: false })
          : Promise.reject(new Error('Open Food Facts is down')),
    );
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('onion');
    await flush();

    expect(screen.getByTestId('food-search-result-food-onion')).toBeTruthy();
    expect(screen.queryByTestId('food-search-error')).toBeNull();
    expect(screen.getByTestId('food-search-products-failed')).toHaveTextContent(
      /Branded products couldn't be loaded\./,
    );
    expect(screen.getByTestId('food-search-products-retry')).toBeTruthy();
  });

  it('never lets an older, slower search replace a newer one', async () => {
    const slow = deferred<unknown>();
    mockSearchFoods.mockImplementation((_token: string, query: string) =>
      query === 'on' ? slow.promise : Promise.resolve({ foods: [onionsRaw], hasMore: false }),
    );
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('on');
    await typeSearch('onion');
    await flush();
    expect(screen.getByTestId('food-search-result-food-onion')).toBeTruthy();

    await act(async () => {
      slow.resolve({ foods: [oreoOriginal], hasMore: false });
    });
    expect(screen.queryByTestId('food-search-result-food-2')).toBeNull();
    expect(screen.getByTestId('food-search-result-food-onion')).toBeTruthy();
  });

  it('says what was searched for when a misspelling was put right', async () => {
    mockSearchFoods.mockResolvedValue({
      foods: [{ ...onionsRaw, id: 'food-broccoli', name: 'Broccoli, raw' }],
      hasMore: false,
      correctedQuery: 'broccoli',
    });
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });

    await typeSearch('brocoli');
    await flush();

    expect(screen.getByTestId('food-search-corrected')).toHaveTextContent(
      'Showing results for “broccoli”',
    );
  });

  it("starts from a food's name, asked for from that food's page", async () => {
    mockSearchFoods.mockResolvedValue({ foods: [onionsRaw], hasMore: false });
    render(
      <FoodSearchScreen
        navigation={navigation}
        route={{ params: { query: 'Egg White, Large' } } as never}
      />,
      { wrapper: TestProviders },
    );

    expect(screen.getByTestId('food-search-input')).toHaveProp('value', 'Egg White, Large');
    await act(async () => {
      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });
    expect(mockSearchFoods).toHaveBeenCalledWith('token-123', 'Egg White, Large');
  });

  it("shows a USDA food's own serving wording and its source", async () => {
    mockSearchFoods.mockResolvedValue({ foods: [onionsRaw], hasMore: false });
    render(<FoodSearchScreen navigation={navigation} route={route} />, { wrapper: TestProviders });
    await typeSearch('onion');

    fireEvent.press(await screen.findByTestId('food-search-result-food-onion'));

    expect(screen.getByTestId('food-search-detail-serving')).toHaveTextContent(
      'Serving: 100 g · 1 medium ≈ 110 g',
    );
    expect(screen.getByTestId('food-search-detail-source')).toHaveTextContent(
      'Source: USDA FoodData Central',
    );
  });
});
