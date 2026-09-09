import { fireEvent, render, screen } from '@testing-library/react-native';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { label: 'KG', value: 'kg' as const },
  { label: 'LB', value: 'lb' as const },
];

describe('SegmentedControl', () => {
  it('renders every option', () => {
    render(<SegmentedControl testID="unit" options={options} value="kg" onChange={jest.fn()} />);

    expect(screen.getByTestId('unit-kg')).toBeTruthy();
    expect(screen.getByTestId('unit-lb')).toBeTruthy();
  });

  it('marks the selected option via accessibilityState', () => {
    render(<SegmentedControl testID="unit" options={options} value="lb" onChange={jest.fn()} />);

    expect(screen.getByTestId('unit-lb').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('unit-kg').props.accessibilityState.selected).toBe(false);
  });

  it('calls onChange with the pressed value', () => {
    const onChange = jest.fn();
    render(<SegmentedControl testID="unit" options={options} value="kg" onChange={onChange} />);

    fireEvent.press(screen.getByTestId('unit-lb'));

    expect(onChange).toHaveBeenCalledWith('lb');
  });

  it('does not call onChange when disabled', () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl testID="unit" options={options} value="kg" onChange={onChange} disabled />,
    );

    fireEvent.press(screen.getByTestId('unit-lb'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
