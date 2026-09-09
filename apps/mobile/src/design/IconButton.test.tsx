import { fireEvent, render, screen } from '@testing-library/react-native';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      <IconButton testID="btn" icon="arrow-left" onPress={onPress} accessibilityLabel="Back" />,
    );

    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).toHaveBeenCalled();
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(
      <IconButton
        testID="btn"
        icon="arrow-left"
        onPress={onPress}
        accessibilityLabel="Back"
        disabled
      />,
    );

    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress while loading', () => {
    const onPress = jest.fn();
    render(
      <IconButton
        testID="btn"
        icon="arrow-left"
        onPress={onPress}
        accessibilityLabel="Back"
        loading
      />,
    );

    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('exposes an accessibility label and disabled state', () => {
    render(
      <IconButton
        testID="btn"
        icon="arrow-left"
        onPress={jest.fn()}
        accessibilityLabel="Back"
        disabled
      />,
    );

    const button = screen.getByTestId('btn');
    expect(button.props.accessibilityLabel).toBe('Back');
    expect(button.props.accessibilityState.disabled).toBe(true);
  });
});
