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

    expect(mockLogFoodEntry).toHaveBeenCalledWith(
      rice,
      2,
      MEAL,
      { amount: 2, unit: 'servings' },
      undefined,
    );
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

  it('always offers grams -- for a serving with no weight, asking what one serving weighs', async () => {
    const cup = { ...rice, servingSize: 1, servingUnit: 'cup' };
    renderStep(cup);

    expect(screen.getByTestId('log-food-quantity').props.accessibilityLabel).toBe('Quantity');
    expect(screen.queryByTestId('log-food-serving-weight')).toBeNull();
    fireEvent.press(screen.getByTestId('log-food-unit-g'));

    // No weight to turn 1 cup into grams with yet: nothing is made up.
    expect(screen.getByTestId('log-food-serving-weight').props.accessibilityLabel).toBe(
      'One serving (1 cup) weighs, in grams',
    );
    expect(screen.getByTestId('log-food-serving-weight-note')).toHaveTextContent(
      'From its label, or weigh one.',
    );
    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '');
    fireEvent.changeText(screen.getByTestId('log-food-quantity'), '120');
    expect(screen.getByTestId('log-food-submit').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('log-food-serving-weight'), '240');
    expect(screen.getByTestId('log-food-amount')).toHaveTextContent('120 g · 0.5 servings');
    await submit();

    expect(mockLogFoodEntry).toHaveBeenCalledWith(
      cup,
      0.5,
      MEAL,
      { amount: 120, unit: 'g' },
      undefined,
    );
  });

  it('takes the weight its serving wording states, asking nothing', () => {
    renderStep({ ...rice, servingSize: 1, servingUnit: 'cup', servingLabel: '1 cup (240 g)' });

    fireEvent.press(screen.getByTestId('log-food-unit-g'));

    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '240');
    expect(screen.queryByTestId('log-food-serving-weight')).toBeNull();
  });

  it("starts a drink's serving weight at its millilitres, which most weigh about the same as", () => {
    renderStep({ ...rice, name: 'Cola', servingSize: 330, servingUnit: 'ml' });

    fireEvent.press(screen.getByTestId('log-food-unit-g'));

    expect(screen.getByTestId('log-food-serving-weight')).toHaveProp('value', '330');
    expect(screen.getByTestId('log-food-serving-weight-note')).toHaveTextContent(
      'Most drinks weigh about the same in grams as in millilitres.',
    );
    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '330');
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

    expect(mockLogFoodEntry).toHaveBeenCalledWith(
      rice,
      2.5,
      MEAL,
      { amount: 250, unit: 'g' },
      undefined,
    );
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

    expect(mockLogFoodEntry).toHaveBeenCalledWith(
      rice,
      2,
      MEAL,
      { amount: 2, unit: 'servings' },
      undefined,
    );
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
    // 4.05 g protein and 0.45 g fat, each rounded down to the gram.
    expect(screen.getByTestId('log-food-protein')).toHaveTextContent('4g');
    expect(screen.getByTestId('log-food-carbs')).toHaveTextContent('42g');
    expect(screen.getByTestId('log-food-fat')).toHaveTextContent('0g');
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
      expect(mockLogFoodEntry).toHaveBeenCalledWith(
        oreo,
        0.67,
        MEAL,
        {
          amount: 2,
          unit: 'pieces',
        },
        undefined,
      );
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

    expect(mockLogFoodEntry).toHaveBeenCalledWith(
      cola,
      0.5,
      MEAL,
      { amount: 165, unit: 'ml' },
      undefined,
    );
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

  it("keeps last time's amount by weight, the serving's weight worked out from it", () => {
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

    // 150 g was 2 cups: 75 g a cup, so nothing needs asking.
    expect(screen.getByTestId('log-food-quantity')).toHaveProp('value', '150');
    expect(screen.queryByTestId('log-food-serving-weight')).toBeNull();
    expect(screen.getByTestId('log-food-amount')).toHaveTextContent('150 g · 2 servings');
  });

  it("falls back to servings when last time's pieces no longer fit the food", () => {
    render(
      <LogFoodStep
        food={rice}
        initialQuantity={2}
        initialEntry={{ amount: 3, unit: 'pieces' }}
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
    // By servings to start -- and, like any food, by weight.
    expect(screen.getByTestId('log-food-unit-servings').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('log-food-unit-g')).toBeTruthy();
  });
});
