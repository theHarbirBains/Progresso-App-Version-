import { render } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { nutritionWidget, stepsWidget } from './homeWidgets';
import { WidgetSync } from './WidgetSync';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../nutrition/FoodLogProvider', () => ({ useFoodLog: jest.fn() }));
jest.mock('../nutrition/NutritionGoalsProvider', () => ({ useNutritionGoals: jest.fn() }));

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

beforeEach(() => {
  jest.clearAllMocks();
});

it("hands Today's Nutrition today's log against the daily targets, and again on every change", () => {
  signedInWith([log(500, 30)]);
  const { rerender } = render(<WidgetSync />);

  const first = jest.mocked(nutritionWidget.updateTimeline).mock.calls[0][0];
  expect(first[0].props).toMatchObject({ calories: '1,500', caption: 'cal left' });

  signedInWith([log(500, 30), log(260, 20)]);
  rerender(<WidgetSync />);

  const second = jest.mocked(nutritionWidget.updateTimeline).mock.calls[1][0];
  expect(second[0].props).toMatchObject({ calories: '1,240' });
});

it('waits for the log to load, and never shows a failed read as an empty day', () => {
  signedInWith([], { loading: true });
  const { rerender } = render(<WidgetSync />);
  signedInWith([], { error: 'Failed to load nutrition' });
  rerender(<WidgetSync />);

  expect(nutritionWidget.updateTimeline).not.toHaveBeenCalled();
});

it('clears every widget on sign-out', () => {
  jest.mocked(useAuth).mockReturnValue({ status: 'signedOut' } as never);
  jest.mocked(useFoodLog).mockReturnValue({ logs: [], loading: false, error: null } as never);
  jest
    .mocked(useNutritionGoals)
    .mockReturnValue({ goals: null, loading: false, error: null } as never);
  render(<WidgetSync />);

  expect(nutritionWidget.updateTimeline).not.toHaveBeenCalled();
  expect(nutritionWidget.updateSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ signedIn: false }),
  );
  expect(stepsWidget.updateSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ signedIn: false }),
  );
});
