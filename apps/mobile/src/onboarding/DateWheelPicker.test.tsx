import { fireEvent, render, screen } from '@testing-library/react-native';
import { DateWheelPicker } from './DateWheelPicker';

describe('DateWheelPicker', () => {
  it('shows a Month Day, Year preview regardless of locale', () => {
    render(
      <DateWheelPicker testID="birthday" month={8} day={14} year={2001} onChange={jest.fn()} />,
    );

    expect(screen.getByText('September 14, 2001')).toBeTruthy();
  });

  it('changing the month clamps an out-of-range day', () => {
    const onChange = jest.fn();
    // January 31st -> switching to February must clamp the day to 28/29.
    render(
      <DateWheelPicker testID="birthday" month={0} day={31} year={2001} onChange={onChange} />,
    );

    fireEvent.press(screen.getByTestId('birthday-month-item-February'));

    expect(onChange).toHaveBeenCalledWith({ month: 1, day: 28, year: 2001 });
  });

  it('changing the day updates only the day', () => {
    const onChange = jest.fn();
    render(
      <DateWheelPicker testID="birthday" month={8} day={14} year={2001} onChange={onChange} />,
    );

    fireEvent.press(screen.getByTestId('birthday-day-item-20'));

    expect(onChange).toHaveBeenCalledWith({ month: 8, day: 20, year: 2001 });
  });

  it('changing the year re-clamps the day for a leap-year edge case', () => {
    const onChange = jest.fn();
    render(
      <DateWheelPicker testID="birthday" month={1} day={29} year={2000} onChange={onChange} />,
    );

    fireEvent.press(screen.getByTestId('birthday-year-item-1999'));

    expect(onChange).toHaveBeenCalledWith({ month: 1, day: 28, year: 1999 });
  });
});
