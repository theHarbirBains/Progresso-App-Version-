import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { todayKey } from '../nutrition/logDay';
import { readAmounts } from '../nutrition/micronutrients/nutrients';
import { MicronutrientsScreen } from './MicronutrientsScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));

let mockProfile: { birthday: string | null; gender: string | null } | null = null;
jest.mock('../profile/ProfileProvider', () => ({ useProfile: () => ({ profile: mockProfile }) }));
jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ nutritionTheme: { accent: '#E8A44A', onAccent: '#1A1206' } }),
}));

let mockTodayLogs: unknown[] = [];
jest.mock('../nutrition/FoodLogProvider', () => ({
  useFoodLog: () => ({ logs: mockTodayLogs, loading: false, error: null }),
}));
let mockDayLogs: Record<string, unknown[]> = {};
jest.mock('../nutrition/useDayLogs', () => ({
  useDayLogs: (_userId: string, day: string | null) => ({
    day,
    logs: day ? (mockDayLogs[day] ?? []) : [],
    loading: false,
    error: null,
  }),
}));
let mockWeek: unknown[][] | null = null;
const mockUseWeekLogs = jest.fn();
// The week of the day asked for, from its Sunday: as many days as the logs given.
jest.mock('../nutrition/micronutrients/useWeekLogs', () => ({
  useWeekLogs: (...args: unknown[]) => {
    mockUseWeekLogs(...args);
    const { shiftDay } = jest.requireActual('../nutrition/logDay');
    const { dayFromKey } = jest.requireActual('../lib/dayKey');
    const day = args[1] as string;
    const sunday = shiftDay(day, -dayFromKey(day).getDay());
    const days = (mockWeek ?? [[], [], []]).map((_, i) => shiftDay(sunday, i));
    return { days, logs: mockWeek, error: null };
  },
}));

const mockNavigate = jest.fn();
const navigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
} as never;

const food = (id: string, name: string, micronutrients: Record<string, number> | null) => ({
  id,
  foodNameSnapshot: name,
  loggedAt: new Date().toISOString(),
  micronutrients: readAmounts(micronutrients),
});
// 100 g chicken breast, 200 g potatoes, 150 g broccoli: their own figures for those amounts.
const DAY = [
  food('log-1', 'Chicken breast', { vitamin_c: 0, iron: 1.04, selenium: 27.6, saturated_fat: 1 }),
  food('log-2', 'Potatoes', { vitamin_c: 19.2, iron: 1.62 }),
  food('log-3', 'Broccoli', { vitamin_c: 134, iron: 1.1 }),
];

function renderScreen(day: string = todayKey()) {
  return render(
    <MicronutrientsScreen navigation={navigation} route={{ params: { day } } as never} />,
  );
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockProfile = { birthday: '1990-06-15', gender: 'female' };
  mockTodayLogs = DAY;
  mockDayLogs = {};
  mockWeek = null;
  mockNavigate.mockClear();
  mockUseWeekLogs.mockClear();
});

describe('MicronutrientsScreen', () => {
  it("lists the day's vitamins against the person's recommendations", async () => {
    renderScreen();
    expect(await screen.findByTestId('micronutrients-reference')).toHaveTextContent(
      /Recommendations for Females 31–50/,
    );
    expect(screen.getByTestId('micronutrients-row-vitamin_c-figure')).toHaveTextContent(
      '153 / 75 mg',
    );
    expect(screen.getByTestId('micronutrients-row-vitamin_c-caption')).toHaveTextContent('204%');
    // Past 100% the bar is simply full -- no warning colour or wording.
    expect(
      screen.getByTestId('micronutrients-row-vitamin_c-bar', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getByTestId('micronutrients-coverage')).toHaveTextContent('3 foods logged');
  });

  it('switches between vitamins, minerals and the rest', async () => {
    renderScreen();
    await screen.findByTestId('micronutrients-row-vitamin_c');
    expect(screen.queryByTestId('micronutrients-row-iron')).toBeNull();

    fireEvent.press(within(screen.getByTestId('micronutrients-category')).getByText('Minerals'));
    expect(screen.getByTestId('micronutrients-row-iron-figure')).toHaveTextContent('3.8 / 18 mg');
    expect(screen.getByTestId('micronutrients-row-selenium-coverage')).toHaveTextContent(
      '1 of 3 foods',
    );

    fireEvent.press(within(screen.getByTestId('micronutrients-category')).getByText('Other'));
    expect(screen.getByTestId('micronutrients-row-saturated_fat')).toHaveTextContent(
      /Saturated Fat.*1 g.*No target · as low as possible/,
    );
  });

  it('says there is no data for a nutrient no food logged has, rather than 0', async () => {
    renderScreen();
    expect(await screen.findByTestId('micronutrients-row-vitamin_b12-figure')).toHaveTextContent(
      '— / 2.4 mcg',
    );
    expect(screen.getByTestId('micronutrients-row-vitamin_b12-caption')).toHaveTextContent(
      'No data',
    );
    expect(
      screen.queryByTestId('micronutrients-row-vitamin_b12-bar', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it("opens each nutrient's own page", async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('micronutrients-row-vitamin_d'));
    expect(mockNavigate).toHaveBeenCalledWith('NutrientDetail', {
      nutrientId: 'vitamin_d',
      day: todayKey(),
      range: 'day',
    });
  });

  it("shows another day's foods, read for that day", async () => {
    mockDayLogs = { '2026-11-10': [food('old', 'Orange', { vitamin_c: 70 })] };
    renderScreen('2026-11-10');
    expect(await screen.findByTestId('micronutrients-row-vitamin_c-figure')).toHaveTextContent(
      '70 / 75 mg',
    );
    expect(screen.getByTestId('micronutrients-date')).toHaveTextContent(/November 10/);
  });

  it('says so when nothing was logged, without counting it as none', async () => {
    mockTodayLogs = [];
    renderScreen();
    expect(await screen.findByTestId('micronutrients-empty')).toHaveTextContent(
      'Nothing logged on this day',
    );
    expect(screen.getByTestId('micronutrients-row-vitamin_c-caption')).toHaveTextContent(
      'Nothing logged',
    );
  });

  it('asks for a birthday before choosing any recommendation', async () => {
    mockProfile = { birthday: null, gender: 'female' };
    renderScreen();
    fireEvent.press(await screen.findByTestId('micronutrients-reference-missing-age'));
    expect(mockNavigate).toHaveBeenCalledWith('SettingsPersonalInfo');
    expect(screen.getByTestId('micronutrients-row-vitamin_c-caption')).toHaveTextContent(
      'Add your details for a target',
    );
  });

  it("asks which values to use when the profile's gender isn't one the tables have", async () => {
    mockProfile = { birthday: '1990-06-15', gender: 'prefer_not_to_say' };
    renderScreen();
    fireEvent.press(await screen.findByTestId('micronutrients-reference-missing-sex'));
    fireEvent.press(within(screen.getByTestId('micronutrients-reference-sex')).getByText('Male'));
    fireEvent.press(screen.getByTestId('micronutrients-reference-done'));
    await waitFor(() =>
      expect(screen.getByTestId('micronutrients-reference')).toHaveTextContent(
        /Recommendations for Males 31–50/,
      ),
    );
    expect(screen.getByTestId('micronutrients-row-vitamin_c-figure')).toHaveTextContent(
      '153 / 90 mg',
    );
    // Kept on the phone for next time.
    expect(JSON.parse((await AsyncStorage.getItem('progresso.micronutrients.user-1'))!)).toEqual({
      sex: 'male',
    });
  });

  it('uses the pregnancy values once chosen', async () => {
    renderScreen();
    fireEvent.press(await screen.findByTestId('micronutrients-reference'));
    fireEvent.press(
      within(screen.getByTestId('micronutrients-reference-stage')).getByText('Pregnant'),
    );
    fireEvent.press(screen.getByTestId('micronutrients-reference-done'));
    await waitFor(() =>
      expect(screen.getByTestId('micronutrients-reference')).toHaveTextContent(
        /Recommendations for Pregnancy, 31–50/,
      ),
    );
    fireEvent.press(within(screen.getByTestId('micronutrients-category')).getByText('Minerals'));
    expect(screen.getByTestId('micronutrients-row-iron-figure')).toHaveTextContent('3.8 / 27 mg');
  });

  it('averages the week over the days logged', async () => {
    mockWeek = [
      [],
      [food('a', 'Orange', { vitamin_c: 70 })],
      [food('b', 'Kiwi', { vitamin_c: 80 })],
    ];
    renderScreen();
    await screen.findByTestId('micronutrients-row-vitamin_c');
    fireEvent.press(within(screen.getByTestId('micronutrients-range')).getByText('Week'));
    expect(mockUseWeekLogs).toHaveBeenLastCalledWith('user-1', todayKey(), navigation);
    // The week's days as a strip on each row.
    expect(
      screen.getByTestId('micronutrients-row-vitamin_c-week', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getByTestId('micronutrients-row-vitamin_c-figure')).toHaveTextContent(
      '75 / 75 mg',
    );
    expect(screen.getByTestId('micronutrients-row-vitamin_c-caption')).toHaveTextContent(
      'Avg 100%',
    );
    expect(screen.getByTestId('micronutrients-coverage')).toHaveTextContent(
      '2 of 3 days logged so far',
    );
  });

  it('tracks the week: each day, how many nutrients reached their target -- a tap opens it', async () => {
    mockWeek = [
      [],
      [food('a', 'Orange', { vitamin_c: 80, iron: 20 })],
      [food('b', 'Kiwi', { vitamin_c: 10 })],
    ];
    // The week of Tuesday, November 10: Sunday the 8th, Monday the 9th, ...
    renderScreen('2026-11-10');
    const week = await screen.findByTestId('micronutrients-week');
    expect(week).toHaveTextContent(/This Week.*Nutrients at target each day, of 26/);
    // Monday: vitamin C (75 mg) and iron (18 mg) reached. Sunday: nothing logged, never 0.
    expect(screen.getByTestId('micronutrients-week-bars-2026-11-09')).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/2 of 26 nutrients at target$/),
    );
    expect(screen.getByTestId('micronutrients-week-bars-2026-11-08')).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(/nothing logged$/),
    );
    fireEvent.press(screen.getByTestId('micronutrients-week-bars-2026-11-09'));
    expect(screen.getByTestId('micronutrients-date')).toHaveTextContent(/November 9/);
  });

  it('never steps past today', async () => {
    renderScreen();
    await screen.findByTestId('micronutrients-row-vitamin_c');
    expect(screen.getByTestId('micronutrients-next').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});
