import { fireEvent, render, screen } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { MembershipChoices } from './MembershipChoices';

const layout = (height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width: 340, height } },
});

describe('MembershipChoices', () => {
  it('shows all three at once, each in a few short lines', () => {
    render(<MembershipChoices testID="m" value={null} onChoose={jest.fn()} />);

    expect(screen.getByTestId('m-card-workouts')).toHaveTextContent(
      /Workouts\s*Free.*Workout plans and live tracking.*Records, progress and ranks.*Friends and group workouts/,
    );
    expect(screen.getByTestId('m-card-workouts_nutrition')).toHaveTextContent(
      /Workouts \+ Nutrition\s*Free.*Everything in Workouts.*Food logging and barcode scans.*Calorie and macro targets/,
    );
    expect(screen.getByTestId('m-card-everything')).toHaveTextContent(
      /Everything\s*Free.*Everything in Workouts \+ Nutrition.*A workspace for your clients.*Log and coach their workouts/,
    );
  });

  it('makes every card as tall as the tallest', () => {
    render(<MembershipChoices testID="m" value={null} onChoose={jest.fn()} />);

    fireEvent(screen.getByTestId('m-card-workouts'), 'layout', layout(150));
    fireEvent(screen.getByTestId('m-card-everything'), 'layout', layout(172));

    for (const tier of ['workouts', 'workouts_nutrition', 'everything']) {
      expect(screen.getByTestId(`m-card-${tier}`)).toHaveStyle({ minHeight: 172 });
    }
  });

  it('chooses one with a tap, ticking the one chosen', () => {
    const onChoose = jest.fn();
    render(<MembershipChoices testID="m" value="workouts" onChoose={onChoose} />);

    expect(screen.getByTestId('m-workouts').props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(screen.getByTestId('m-everything'));
    expect(onChoose).toHaveBeenCalledWith('everything');
  });

  it('puts all its text inside Text', () => {
    render(<MembershipChoices testID="m" value={null} onChoose={jest.fn()} />);
    expectNoBareText();
  });
});
