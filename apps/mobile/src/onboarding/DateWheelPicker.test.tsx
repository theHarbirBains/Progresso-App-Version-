import { FlatList } from 'react-native';
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

  // The wheels draw only the items near the one chosen, so their whole lists are read instead.
  function wheels() {
    const [months, days, years] = screen
      .UNSAFE_getAllByType(FlatList)
      .map((list) => list.props.data as string[]);
    return { months: months!, days: days!, years: years! };
  }

  it('goes no later than the latest date given -- not a year, a month or a day past it', () => {
    const latest = { month: 10, day: 15, year: 2013 };
    render(
      <DateWheelPicker
        testID="birthday"
        month={10}
        day={1}
        year={2013}
        onChange={jest.fn()}
        latest={latest}
      />,
    );

    const { months, days, years } = wheels();
    expect(years[0]).toBe('2013');
    expect(months.at(-1)).toBe('November');
    expect(days.at(-1)).toBe('15');
  });

  it('keeps every month and day in an earlier year', () => {
    render(
      <DateWheelPicker
        testID="birthday"
        month={11}
        day={1}
        year={2012}
        onChange={jest.fn()}
        latest={{ month: 10, day: 15, year: 2013 }}
      />,
    );

    const { months, days } = wheels();
    expect(months).toHaveLength(12);
    expect(days).toHaveLength(31);
  });

  it('comes back to the latest date when a change would pass it', () => {
    const onChange = jest.fn();
    const latest = { month: 10, day: 15, year: 2013 };
    // October 20, 2013 -- moving to November would be past November 15.
    render(
      <DateWheelPicker
        testID="birthday"
        month={9}
        day={20}
        year={2013}
        onChange={onChange}
        latest={latest}
      />,
    );

    fireEvent.press(screen.getByTestId('birthday-month-item-November'));

    expect(onChange).toHaveBeenCalledWith(latest);
  });
});
