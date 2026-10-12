import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useFoodLog } from './FoodLogProvider';
import { LogFoodStep, type LoggableFood } from './LogFoodStep';

jest.mock('./FoodLogProvider', () => ({
  useFoodLog: jest.fn(),
}));

const mockUseFoodLog = useFoodLog as jest.Mock;
const mockLogFoodEntry = jest.fn();

const rice: LoggableFood = {
  id: 'food-rice',
  name: 'White Rice',
  servingSize: 100,
  servingUnit: 'g',
  calories: 130,
  proteinG: 2.7,
  carbsG: 28,
  fatG: 0.3,
};

const MEAL = expect.stringMatching(/^(breakfast|lunch|dinner|snack)$/);

beforeEach(() => {
  mockLogFoodEntry.mockReset().mockResolvedValue({});
  mockUseFoodLog.mockReturnValue({ logFoodEntry: mockLogFoodEntry });
});

function renderStep(food: LoggableFood = rice, initialQuantity?: number) {
  const onDone = jest.fn();
  render(
    <LogFoodStep
      food={food}
      initialQuantity={initialQuantity}
      accentColor="#3DDC97"
      onAccentColor="#000000"
      onDone={onDone}
      onCancel={jest.fn()}
    />,
  );
  return { onDone };
}

async function submit() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('log-food-submit'));
  });
}

describe('LogFoodStep', () => {
  it('starts at one serving', () => {
    renderStep();

    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '1');
  });

  it("starts at the quantity it is given, such as last time's from Recent", async () => {
    const { onDone } = renderStep(rice, 2);

    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '2');
    expect(screen.getByTestId('log-food-preview')).toHaveTextContent(/260 cal/);
    await submit();

    expect(mockLogFoodEntry).toHaveBeenCalledWith(rice, 2, MEAL);
    expect(onDone).toHaveBeenCalled();
  });

  it('offers Servings, g and oz when the serving is a weight, starting on servings', () => {
    renderStep();

    expect(screen.getByTestId('log-food-unit-servings').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('log-food-unit-g').props.accessibilityLabel).toBe('Grams');
    expect(screen.getByTestId('log-food-unit-oz').props.accessibilityLabel).toBe('Ounces');
  });

  it('offers no unit switch when the serving is not a weight', () => {
    renderStep({ ...rice, servingSize: 1, servingUnit: 'cup' });

    expect(screen.queryByTestId('log-food-unit')).toBeNull();
    expect(screen.getByTestId('log-food-quantity').props.accessibilityLabel).toBe('Quantity');
  });

  it('logs 250 g of a 100 g serving as 2.5 servings', async () => {
    renderStep();

    fireEvent.press(screen.getByTestId('log-food-unit-g'));
    // The amount carries over: 1 serving is 100 g.
    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '100');
    expect(screen.getByTestId('log-food-quantity').props.accessibilityLabel).toBe('Grams');
    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '250');

    expect(screen.getByTestId('log-food-preview')).toHaveTextContent(/2\.5 servings · 325 cal/);
    await submit();

    expect(mockLogFoodEntry).toHaveBeenCalledWith(rice, 2.5, MEAL);
  });

  it('logs ounces as servings too, and switching back keeps the amount', async () => {
    renderStep();

    fireEvent.press(screen.getByTestId('log-food-unit-oz'));
    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '3.53');
    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '7.05');
    expect(screen.getByTestId('log-food-preview')).toHaveTextContent(/^2 servings/);

    fireEvent.press(screen.getByTestId('log-food-unit-servings'));
    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '2');
    await submit();

    expect(mockLogFoodEntry).toHaveBeenCalledWith(rice, 2, MEAL);
  });

  it('will not log an amount that comes to no servings', async () => {
    renderStep();

    fireEvent.press(screen.getByTestId('log-food-unit-g'));
    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '0.1');

    expect(screen.queryByTestId('log-food-preview')).toBeNull();
    expect(screen.getByTestId('log-food-submit').props.accessibilityState.disabled).toBe(true);
    await submit();
    expect(mockLogFoodEntry).not.toHaveBeenCalled();
  });

  it('renders no bare text outside <Text> with the unit switch shown', () => {
    renderStep();

    fireEvent.press(screen.getByTestId('log-food-unit-g'));
    expectNoBareText();
  });
});
