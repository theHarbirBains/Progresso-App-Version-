import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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

describe('TimeRangeSelector -- named chips with a 44pt touch area', () => {
  it('names each chip in full and marks the selected one', () => {
    render(
      <TimeRangeSelector
        value="3m"
        onChange={jest.fn()}
        accentColor="#2F80FF"
        onAccentColor="#000000"
      />,
    );

    const selected = screen.getByTestId('time-range-3m');
    expect(selected.props.accessibilityLabel).toBe('3 Months');
    expect(selected.props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('time-range-all').props.accessibilityLabel).toBe('All Time');
  });

  it('draws 36pt chips whose hit area reaches 44pt', () => {
    render(
      <TimeRangeSelector
        value="3m"
        onChange={jest.fn()}
        accentColor="#2F80FF"
        onAccentColor="#000000"
      />,
    );

    const chip = screen.getByTestId('time-range-4w');
    const slop = chip.props.hitSlop as { top: number; bottom: number };
    expect(
      StyleSheet.flatten(chip.props.style).minHeight + slop.top + slop.bottom,
    ).toBeGreaterThanOrEqual(44);
  });
});
