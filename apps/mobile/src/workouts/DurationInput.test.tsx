import { fireEvent, render, screen } from '@testing-library/react-native';
import { DurationInput } from './DurationInput';

describe('DurationInput', () => {
  it('shows the given hours and minutes', () => {
    render(
      <DurationInput
        testID="duration"
        hours="1"
        minutes="26"
        onChangeHours={jest.fn()}
        onChangeMinutes={jest.fn()}
      />,
    );

    expect(screen.getByTestId('duration-hours').props.value).toBe('1');
    expect(screen.getByTestId('duration-minutes').props.value).toBe('26');
  });

  it('calls onChangeHours and onChangeMinutes independently', () => {
    const onChangeHours = jest.fn();
    const onChangeMinutes = jest.fn();
    render(
      <DurationInput
        testID="duration"
        hours=""
        minutes=""
        onChangeHours={onChangeHours}
        onChangeMinutes={onChangeMinutes}
      />,
    );

    fireEvent.changeText(screen.getByTestId('duration-hours'), '2');
    fireEvent.changeText(screen.getByTestId('duration-minutes'), '15');

    expect(onChangeHours).toHaveBeenCalledWith('2');
    expect(onChangeMinutes).toHaveBeenCalledWith('15');
  });

  it('labels each field for assistive tech', () => {
    render(
      <DurationInput
        testID="duration"
        hours=""
        minutes=""
        onChangeHours={jest.fn()}
        onChangeMinutes={jest.fn()}
      />,
    );

    expect(screen.getByTestId('duration-hours').props.accessibilityLabel).toBe('Duration, hours');
    expect(screen.getByTestId('duration-minutes').props.accessibilityLabel).toBe(
      'Duration, minutes',
    );
  });
});
