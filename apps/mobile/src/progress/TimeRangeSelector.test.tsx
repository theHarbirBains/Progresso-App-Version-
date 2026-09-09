import { fireEvent, render, screen } from '@testing-library/react-native';
import { TimeRangeSelector } from './TimeRangeSelector';

describe('TimeRangeSelector', () => {
  it('renders every time range option', () => {
    render(
      <TimeRangeSelector
        value="3m"
        onChange={jest.fn()}
        accentColor="#2F80FF"
        onAccentColor="#000000"
      />,
    );

    for (const id of ['4w', '3m', '6m', '1y', 'all']) {
      expect(screen.getByTestId(`time-range-${id}`)).toBeTruthy();
    }
  });

  it('marks the current value as selected', () => {
    render(
      <TimeRangeSelector
        value="6m"
        onChange={jest.fn()}
        accentColor="#2F80FF"
        onAccentColor="#000000"
      />,
    );

    expect(screen.getByTestId('time-range-6m').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('time-range-3m').props.accessibilityState.selected).toBe(false);
  });

  it('calls onChange with the pressed range', () => {
    const onChange = jest.fn();
    render(
      <TimeRangeSelector
        value="3m"
        onChange={onChange}
        accentColor="#2F80FF"
        onAccentColor="#000000"
      />,
    );

    fireEvent.press(screen.getByTestId('time-range-1y'));

    expect(onChange).toHaveBeenCalledWith('1y');
  });
});
