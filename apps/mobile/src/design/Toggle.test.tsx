import { fireEvent, render, screen } from '@testing-library/react-native';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('reflects the current value', () => {
    render(
      <Toggle
        testID="toggle"
        value={true}
        onValueChange={jest.fn()}
        accessibilityLabel="Email opt-in"
      />,
    );

    expect(screen.getByTestId('toggle').props.value).toBe(true);
  });

  it('calls onValueChange with the flipped value', () => {
    const onValueChange = jest.fn();
    render(
      <Toggle
        testID="toggle"
        value={false}
        onValueChange={onValueChange}
        accessibilityLabel="Email opt-in"
      />,
    );

    fireEvent(screen.getByTestId('toggle'), 'valueChange', true);

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('exposes an accessibility label and switch role', () => {
    render(
      <Toggle
        testID="toggle"
        value={false}
        onValueChange={jest.fn()}
        accessibilityLabel="Email opt-in"
      />,
    );

    const toggle = screen.getByTestId('toggle');
    expect(toggle.props.accessibilityLabel).toBe('Email opt-in');
    expect(toggle.props.accessibilityRole).toBe('switch');
  });

  it('is disabled when disabled is passed', () => {
    render(
      <Toggle
        testID="toggle"
        value={false}
        onValueChange={jest.fn()}
        accessibilityLabel="x"
        disabled
      />,
    );

    expect(screen.getByTestId('toggle').props.disabled).toBe(true);
  });
});
