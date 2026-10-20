import { Alert } from 'react-native';
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
  mockUseFoodLog.mockReturnValue({ logs: [], logFoodEntry: mockLogFoodEntry });
  jest.restoreAllMocks();
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
    expect(screen.getByTestId('log-food-calories')).toHaveTextContent(/260/);
    await submit();

    expect(mockLogFoodEntry).toHaveBeenCalledWith(rice, 2, MEAL, { amount: 2, unit: 'servings' });
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

    expect(screen.getByTestId('log-food-amount')).toHaveTextContent('250 g · 2.5 servings');
    expect(screen.getByTestId('log-food-calories')).toHaveTextContent(/325/);
    await submit();

    expect(mockLogFoodEntry).toHaveBeenCalledWith(rice, 2.5, MEAL, { amount: 250, unit: 'g' });
  });

  it('logs ounces as servings too, and switching back keeps the amount', async () => {
    renderStep();

    fireEvent.press(screen.getByTestId('log-food-unit-oz'));
    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '3.53');
    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '7.05');
    expect(screen.getByTestId('log-food-amount')).toHaveTextContent('7.05 oz · 2 servings');

    fireEvent.press(screen.getByTestId('log-food-unit-servings'));
    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '2');
    await submit();

    expect(mockLogFoodEntry).toHaveBeenCalledWith(rice, 2, MEAL, { amount: 2, unit: 'servings' });
  });

  it('will not log an amount that comes to no servings', async () => {
    renderStep();

    fireEvent.press(screen.getByTestId('log-food-unit-g'));
    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '0.1');

    expect(screen.getByTestId('log-food-calories')).toHaveTextContent('—');
    expect(screen.getByTestId('log-food-protein')).toHaveTextContent('—');
    expect(screen.getByTestId('log-food-submit').props.accessibilityState.disabled).toBe(true);
    await submit();
    expect(mockLogFoodEntry).not.toHaveBeenCalled();
  });

  it('works out the calories and macros from the amount as it is typed', () => {
    renderStep();

    expect(screen.getByTestId('log-food-amount')).toHaveTextContent('1 serving · 100 g');
    expect(screen.getByTestId('log-food-calories')).toHaveTextContent(/130/);
    expect(screen.getByTestId('log-food-carbs')).toHaveTextContent(/28/);

    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '1.5');

    expect(screen.getByTestId('log-food-amount')).toHaveTextContent('1.5 servings · 150 g');
    expect(screen.getByTestId('log-food-calories')).toHaveTextContent(/195/);
    expect(screen.getByTestId('log-food-protein')).toHaveTextContent(/4\.1/);
    expect(screen.getByTestId('log-food-carbs')).toHaveTextContent(/42/);
    expect(screen.getByTestId('log-food-fat')).toHaveTextContent(/0\.5/);
  });

  it('shows the serving the amount is measured against', () => {
    renderStep();

    expect(screen.getByTestId('log-food-serving')).toHaveTextContent('1 serving: 100 g');
  });

  describe('a serving worded in pieces: "3 cookies (34 g)"', () => {
    const oreo: LoggableFood = {
      id: 'food-oreo',
      name: 'Oreo Original',
      servingSize: 34,
      servingUnit: 'g',
      servingLabel: '3 cookies (34 g)',
      calories: 160,
      proteinG: 1.6,
      carbsG: 25,
      fatG: 7,
    };

    it('offers Cookies beside Servings, g and oz, and starts on it at one serving', () => {
      renderStep(oreo);

      expect(screen.getByTestId('log-food-unit-pieces')).toHaveTextContent('Cookies');
      expect(screen.getByTestId('log-food-unit-pieces').props.accessibilityState.selected).toBe(
        true,
      );
      expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '3');
      expect(screen.getByTestId('log-food-quantity').props.accessibilityLabel).toBe('Cookies');
      expect(screen.getByTestId('log-food-serving')).toHaveTextContent(
        '1 serving: 3 cookies (34 g)',
      );
    });

    it('logs 2 cookies as two thirds of a serving', async () => {
      renderStep(oreo);

      fireEvent.changeText(screen.getByTestId('log-food-quantity'), '2');
      expect(screen.getByTestId('log-food-amount')).toHaveTextContent('2 cookies · 23 g');
      expect(screen.getByTestId('log-food-calories')).toHaveTextContent(/107/);
      await submit();

      // Kept as typed, so Today shows 2 cookies.
      expect(mockLogFoodEntry).toHaveBeenCalledWith(oreo, 0.67, MEAL, {
        amount: 2,
        unit: 'pieces',
      });
    });

    it('says one cookie in the singular, and can still be switched to grams', () => {
      renderStep(oreo);

      fireEvent.changeText(screen.getByTestId('log-food-quantity'), '1');
      expect(screen.getByTestId('log-food-amount')).toHaveTextContent('1 cookie · 11 g');

      fireEvent.press(screen.getByTestId('log-food-unit-g'));
      expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '11.22');
    });

    it("starts last time's Recent quantity in cookies too", () => {
      renderStep(oreo, 2);

      expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '6');
    });
  });

  it('renders no bare text outside <Text> with the unit switch shown', () => {
    renderStep();

    fireEvent.press(screen.getByTestId('log-food-unit-g'));
    expectNoBareText();
  });
});

describe('LogFoodStep -- drinks, last time and double taps', () => {
  const cola: LoggableFood = {
    id: 'food-cola',
    name: 'Cola',
    servingSize: 330,
    servingUnit: 'ml',
    calories: 139,
    proteinG: 0,
    carbsG: 35,
    fatG: 0,
  };

  it('logs a drink in millilitres', async () => {
    renderStep(cola);

    expect(screen.getByTestId('log-food-unit-ml').props.accessibilityLabel).toBe('Millilitres');
    fireEvent.press(screen.getByTestId('log-food-unit-ml'));
    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '330');
    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '165');
    expect(screen.getByTestId('log-food-amount')).toHaveTextContent('165 ml · 0.5 servings');
    await submit();

    expect(mockLogFoodEntry).toHaveBeenCalledWith(cola, 0.5, MEAL, { amount: 165, unit: 'ml' });
  });

  it('starts in the amount and unit typed last time', () => {
    render(
      <LogFoodStep
        food={rice}
        initialQuantity={1.5}
        initialEntry={{ amount: 150, unit: 'g' }}
        accentColor="#3DDC97"
        onAccentColor="#000000"
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('log-food-unit-g').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '150');
  });

  it("falls back to servings when last time's unit no longer fits the food", () => {
    render(
      <LogFoodStep
        food={{ ...rice, servingSize: 1, servingUnit: 'cup' }}
        initialQuantity={2}
        initialEntry={{ amount: 150, unit: 'g' }}
        accentColor="#3DDC97"
        onAccentColor="#000000"
        onDone={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '2');
  });

  it('asks before logging the same food again seconds later', async () => {
    mockUseFoodLog.mockReturnValue({
      logs: [{ foodId: 'food-rice', loggedAt: new Date(Date.now() - 2000).toISOString() }],
      logFoodEntry: mockLogFoodEntry,
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderStep();

    await submit();

    expect(alert).toHaveBeenCalledWith(
      'Log it again?',
      'You logged White Rice a few seconds ago.',
      expect.any(Array),
    );
    expect(mockLogFoodEntry).not.toHaveBeenCalled();

    // "Log Again" logs it.
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => {
      buttons.find((b) => b.text === 'Log Again')!.onPress!();
    });
    expect(mockLogFoodEntry).toHaveBeenCalled();
  });
});

describe('LogFoodStep -- choosing an amount for a meal or a recipe', () => {
  it('hands back the amount instead of logging, under the label it is given', async () => {
    const onChoose = jest.fn();
    render(
      <LogFoodStep
        food={rice}
        accentColor="#3DDC97"
        onAccentColor="#000000"
        onCancel={jest.fn()}
        onChoose={onChoose}
        chooseLabel="Add to Recipe"
      />,
    );

    fireEvent.press(screen.getByTestId('log-food-unit-g'));
    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '150');
    expect(screen.getByTestId('log-food-submit')).toHaveTextContent('Add to Recipe');
    await submit();

    expect(onChoose).toHaveBeenCalledWith({ quantity: 1.5, entered: { amount: 150, unit: 'g' } });
    expect(mockLogFoodEntry).not.toHaveBeenCalled();
  });

  it("doesn't ask about a double log, since nothing is logged", async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockUseFoodLog.mockReturnValue({
      logs: [{ foodId: rice.id, loggedAt: new Date().toISOString() }],
      logFoodEntry: mockLogFoodEntry,
    });
    const onChoose = jest.fn();
    render(
      <LogFoodStep
        food={rice}
        accentColor="#3DDC97"
        onAccentColor="#000000"
        onCancel={jest.fn()}
        onChoose={onChoose}
      />,
    );

    await submit();

    expect(alert).not.toHaveBeenCalled();
    expect(onChoose).toHaveBeenCalled();
  });
});

describe('LogFoodStep -- a recipe', () => {
  it('says how many servings the recipe makes, in place of the serving size', () => {
    renderStep({
      ...rice,
      name: 'Smoothie',
      servingSize: 1,
      servingUnit: 'serving',
      recipeServings: 4,
    });

    expect(screen.getByTestId('log-food-serving')).toHaveTextContent('Recipe · makes 4 servings');
    expect(screen.queryByTestId('log-food-unit')).toBeNull();
  });
});
