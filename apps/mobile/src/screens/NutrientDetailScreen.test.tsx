import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { todayKey } from '../nutrition/logDay';
import { readAmounts } from '../nutrition/micronutrients/nutrients';
import { NutrientDetailScreen } from './NutrientDetailScreen';

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
let mockProfile = { birthday: '1990-06-15', gender: 'female' };
jest.mock('../profile/ProfileProvider', () => ({ useProfile: () => ({ profile: mockProfile }) }));
jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ nutritionTheme: { accent: '#E8A44A', onAccent: '#1A1206' } }),
}));
let mockTodayLogs: unknown[] = [];
jest.mock('../nutrition/FoodLogProvider', () => ({
  useFoodLog: () => ({ logs: mockTodayLogs, loading: false, error: null }),
}));
jest.mock('../nutrition/useDayLogs', () => ({
  useDayLogs: (_userId: string, day: string | null) => ({
    day,
    logs: [],
    loading: false,
    error: null,
  }),
}));
// The week read: just the day asked for, with nothing logged -- the page puts today's own foods in.
jest.mock('../nutrition/micronutrients/useWeekLogs', () => ({
  useWeekLogs: (_userId: string, day: string | null) => ({
    days: day ? [day] : [],
    logs: day ? [[]] : null,
    error: null,
  }),
}));

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
} as never;

const food = (id: string, name: string, micronutrients: Record<string, number> | null) => ({
  id,
  foodNameSnapshot: name,
  loggedAt: new Date().toISOString(),
  micronutrients: readAmounts(micronutrients),
});

function renderDetail(nutrientId: string) {
  return render(
    <NutrientDetailScreen
      navigation={navigation}
      route={{ params: { nutrientId, day: todayKey(), range: 'day' } } as never}
    />,
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockProfile = { birthday: '1990-06-15', gender: 'female' };
  mockTodayLogs = [
    food('log-1', 'Salmon', { vitamin_d: 11, magnesium: 30, vitamin_c: 0 }),
    food('log-2', 'Milk', { vitamin_d: 2.9, magnesium: 24 }),
    food('log-3', 'Granola bar', null),
  ];
  (WebBrowser.openBrowserAsync as jest.Mock).mockClear();
});

describe('NutrientDetailScreen', () => {
  it("shows today's intake, and the foods it's from and isn't", async () => {
    renderDetail('vitamin_d');
    expect(await screen.findByTestId('nutrient-detail-amount')).toHaveTextContent('14');
    expect(screen.getByTestId('nutrient-detail-intake')).toHaveTextContent(/of 15 mcg/);
    expect(screen.getByTestId('nutrient-detail-caption')).toHaveTextContent(
      /93% of your recommendation/,
    );
    expect(screen.getByTestId('nutrient-detail-coverage')).toHaveTextContent(/From 2 of 3 foods/);
    expect(screen.getByTestId('nutrient-detail-foods')).toHaveTextContent(
      /Salmon.*11 mcg.*Milk.*2.9 mcg/,
    );
    expect(screen.getByTestId('nutrient-detail-foods-missing')).toHaveTextContent(
      /No data, so not counted: Granola bar/,
    );
  });

  it('shows the week day by day against the target -- unknown, not 0, on a day without data', async () => {
    renderDetail('vitamin_d');
    const today = todayKey();
    // Today's 13.9 mcg of the 15: 93%.
    expect(await screen.findByTestId(`nutrient-detail-week-bars-${today}`)).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/93%$/),
    );
    expect(screen.getByTestId('nutrient-detail-week')).toHaveTextContent(
      /This Week.*against 15 mcg/,
    );
  });

  it('explains it in plain words, from its sources', async () => {
    renderDetail('vitamin_d');
    expect(await screen.findByTestId('nutrient-detail-does')).toHaveTextContent(
      /What It Does.*Helps your body absorb calcium/,
    );
    // Short: the first sentence, the rest a tap away -- nothing cut.
    expect(screen.getByTestId('nutrient-detail-low')).not.toHaveTextContent(/rickets in children/);
    fireEvent.press(screen.getByTestId('nutrient-detail-low-text-more'));
    expect(screen.getByTestId('nutrient-detail-low')).toHaveTextContent(/rickets in children/);
    expect(screen.getByTestId('nutrient-detail-low')).toHaveTextContent(/isn’t a deficiency/);
    fireEvent.press(screen.getByTestId('nutrient-detail-high-text-more'));
    expect(screen.getByTestId('nutrient-detail-high')).toHaveTextContent(
      /Kidney stones|kidney stones/,
    );
  });

  it('gives the recommendation for their life stage and the upper limit apart from it', async () => {
    renderDetail('vitamin_d');
    expect(await screen.findByTestId('nutrient-detail-recommended')).toHaveTextContent(
      /15 mcg per day \(600 IU\)/,
    );
    expect(screen.getByTestId('nutrient-detail-recommendation')).toHaveTextContent(
      /Recommended Dietary Allowance for Females 31–50/,
    );
    expect(screen.getByTestId('nutrient-detail-ul')).toHaveTextContent(
      /100 mcg per day \(4,000 IU\)/,
    );
    expect(screen.getByTestId('nutrient-detail-upper-limit')).toHaveTextContent(
      /A safety limit, not a daily goal/,
    );
  });

  it('links every source, opening it in the browser', async () => {
    renderDetail('vitamin_d');
    const hc = await screen.findByTestId('nutrient-detail-source-hc_vitamins');
    expect(hc).toHaveTextContent(
      /Reference values for vitamins.*Health Canada · updated 2025-11-19/,
    );
    expect(screen.getByTestId('nutrient-detail-source-mlp_vitamin_d')).toHaveTextContent(
      /Vitamin D: MedlinePlus Medical Encyclopedia.*reviewed 2025-01-21/,
    );
    fireEvent.press(screen.getByTestId('nutrient-detail-source-mlp_vitamin_d'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      'https://medlineplus.gov/ency/article/002405.htm',
    );
    expect(screen.getByTestId('nutrient-detail-source-usda')).toBeTruthy();
  });

  it("says what an upper limit covers, and never holds food to one that's for supplements", async () => {
    mockTodayLogs = [food('log-1', 'Seeds', { magnesium: 500 })];
    renderDetail('magnesium');
    expect(await screen.findByTestId('nutrient-detail-upper-limit')).toHaveTextContent(
      /A safety limit for supplements, not food/,
    );
    expect(screen.getByTestId('nutrient-detail-upper-limit')).toHaveTextContent(
      /represents intake from a pharmacological agent only/,
    );
    expect(screen.queryByTestId('nutrient-detail-over')).toBeNull();
  });

  it('notes, calmly, a total above an upper limit that covers food', async () => {
    mockTodayLogs = [food('log-1', 'Supplement drink', { vitamin_c: 2100 })];
    renderDetail('vitamin_c');
    expect(await screen.findByTestId('nutrient-detail-over')).toHaveTextContent(
      'Today’s logged total is above this level.',
    );
  });

  it('says when Health Canada set no upper limit, in its own words', async () => {
    renderDetail('vitamin_b12');
    expect(await screen.findByTestId('nutrient-detail-ul')).toHaveTextContent(
      'Health Canada hasn’t set an upper limit.',
    );
    // With no other source on too much B12, its note on the missing limit is what's said.
    fireEvent.press(screen.getByTestId('nutrient-detail-high-text-more'));
    expect(screen.getByTestId('nutrient-detail-high')).toHaveTextContent(
      /ULs could not be established for vitamin B12.*does not mean that there is no potential for adverse effects/,
    );
  });

  it("says so where there's no source to explain it, rather than guessing", async () => {
    renderDetail('manganese');
    expect(await screen.findByTestId('nutrient-detail-does-unavailable')).toBeTruthy();
    expect(screen.getByTestId('nutrient-detail-low-unavailable')).toBeTruthy();
    expect(screen.getByTestId('nutrient-detail-high-unavailable')).toBeTruthy();
    // Its reference values are still Health Canada's.
    expect(screen.getByTestId('nutrient-detail-recommendation')).toHaveTextContent(
      /1.8 mg per day.*Adequate Intake for Females 31–50/,
    );
  });

  it('gives a fat with no target its guidance and no limit', async () => {
    renderDetail('saturated_fat');
    expect(await screen.findByTestId('nutrient-detail-guidance')).toHaveTextContent(
      'As low as possible while consuming a nutritionally adequate diet',
    );
    expect(screen.queryByTestId('nutrient-detail-upper-limit')).toBeNull();
  });

  it('asks for a birthday before giving a recommendation', async () => {
    mockProfile = { birthday: null as never, gender: 'female' };
    renderDetail('iron');
    expect(await screen.findByTestId('nutrient-detail-no-recommendation')).toHaveTextContent(
      /Add your birthday/,
    );
  });
});
