import { fireEvent, render, screen } from '@testing-library/react-native';
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle';

describe('PasswordVisibilityToggle', () => {
  it('calls onToggle when pressed', () => {
    const onToggle = jest.fn();
    render(<PasswordVisibilityToggle testID="toggle" visible={false} onToggle={onToggle} />);

    fireEvent.press(screen.getByTestId('toggle'));

    expect(onToggle).toHaveBeenCalled();
  });

  it('labels itself "Show password" when hidden, "Hide password" when visible', () => {
    const { rerender } = render(
      <PasswordVisibilityToggle testID="toggle" visible={false} onToggle={jest.fn()} />,
    );
    expect(screen.getByTestId('toggle').props.accessibilityLabel).toBe('Show password');

    rerender(<PasswordVisibilityToggle testID="toggle" visible onToggle={jest.fn()} />);
    expect(screen.getByTestId('toggle').props.accessibilityLabel).toBe('Hide password');
  });
});
