import { render, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { widgetShown } from '../testUtils/widgetShown';
import { useAppTheme } from '../theme/appThemeContext';
import { themeById } from '../theme/appThemes';
import { homeWidgets } from './homeWidgets';
import { WidgetSync } from './WidgetSync';

const { nutritionWidget, nextWorkoutWidget, stepsWidget } = homeWidgets();

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../nutrition/FoodLogProvider', () => ({ useFoodLog: jest.fn() }));
jest.mock('../nutrition/NutritionGoalsProvider', () => ({ useNutritionGoals: jest.fn() }));
jest.mock('../theme/appThemeContext', () => ({ useAppTheme: jest.fn() }));

const log = (calories: number, proteinG: number) => ({
  id: `log-${calories}`,
  calories,
  proteinG,
  carbsG: 10,
  fatG: 5,
});

function signedInWith(logs: unknown[], extra: Record<string, unknown> = {}) {
  jest.mocked(useAuth).mockReturnValue({ status: 'signedIn' } as never);
  jest.mocked(useFoodLog).mockReturnValue({ logs, loading: false, error: null, ...extra } as never);
  jest.mocked(useNutritionGoals).mockReturnValue({
    goals: { calories: 2000, proteinG: 150, carbsG: 220, fatG: 60 },
    loading: false,
    error: null,
  } as never);
}

function wearing(id: string, loaded = true) {
  jest.mocked(useAppTheme).mockReturnValue({ theme: themeById(id), loaded } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  wearing('golden-hour-gym');
});

it("hands Today's Nutrition today's log against the daily targets, and again on every change", async () => {
  signedInWith([log(500, 30)]);
  const { rerender } = render(<WidgetSync />);

  await waitFor(() =>
    expect(widgetShown(nutritionWidget)).toMatchObject({
      calories: '1,500',
      caption: 'calories left',
    }),
  );

  signedInWith([log(500, 30), log(260, 20)]);
  rerender(<WidgetSync />);

  await waitFor(() => expect(widgetShown(nutritionWidget)).toMatchObject({ calories: '1,240' }));
});

it('waits for the log to load, and never shows a failed read as an empty day', async () => {
  signedInWith([], { loading: true });
  const { rerender } = render(<WidgetSync />);
  signedInWith([], { error: 'Failed to load nutrition' });
  rerender(<WidgetSync />);

  // The theme is applied (it reads each widget), but nothing is handed to Today's Nutrition.
  await waitFor(() => expect(nutritionWidget.getTimeline).toHaveBeenCalled());
  expect(nutritionWidget.updateTimeline).not.toHaveBeenCalled();
});

it('clears every widget on sign-out', async () => {
  jest.mocked(useAuth).mockReturnValue({ status: 'signedOut' } as never);
  jest.mocked(useFoodLog).mockReturnValue({ logs: [], loading: false, error: null } as never);
  jest
    .mocked(useNutritionGoals)
    .mockReturnValue({ goals: null, loading: false, error: null } as never);
  render(<WidgetSync />);

  await waitFor(() => expect(widgetShown(nutritionWidget)).toMatchObject({ signedIn: false }));
  expect(widgetShown(nextWorkoutWidget)).toMatchObject({ signedIn: false });
  expect(widgetShown(stepsWidget)).toMatchObject({ signedIn: false });
});

it('dresses what the widgets show in the theme once it is read, and again when it changes', async () => {
  signedInWith([], { loading: true });
  jest.mocked(stepsWidget.getTimeline).mockResolvedValue([
    {
      date: new Date(2026, 10, 1, 9),
      props: { signedIn: true, steps: '8,412', caption: 'As of 9:00 AM', accent: '#D99A50' },
    },
  ]);
  wearing('forest', false);
  const { rerender } = render(<WidgetSync />);
  wearing('forest');
  rerender(<WidgetSync />);

  await waitFor(() =>
    expect(widgetShown(stepsWidget)).toMatchObject({ steps: '8,412', accent: '#9DBF7A' }),
  );
  // Not before the saved choice was read: only Forest was ever applied.
  expect(stepsWidget.updateTimeline).toHaveBeenCalledTimes(1);

  wearing('winter');
  rerender(<WidgetSync />);
  await waitFor(() => expect(widgetShown(stepsWidget)).toMatchObject({ accent: '#A9C4E0' }));
});
