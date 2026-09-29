import { StyleSheet } from 'react-native';
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

describe('IconButton badge', () => {
  it('shows no badge when badgeCount is omitted or zero', () => {
    render(<IconButton testID="btn" icon="bell" onPress={jest.fn()} accessibilityLabel="Alerts" />);
    expect(screen.queryByTestId('btn-badge')).toBeNull();

    render(
      <IconButton
        testID="btn2"
        icon="bell"
        onPress={jest.fn()}
        accessibilityLabel="Alerts"
        badgeCount={0}
      />,
    );
    expect(screen.queryByTestId('btn2-badge')).toBeNull();
  });

  it('shows the count on the badge', () => {
    render(
      <IconButton
        testID="btn"
        icon="bell"
        onPress={jest.fn()}
        accessibilityLabel="Alerts"
        badgeCount={3}
      />,
    );

    expect(screen.getByTestId('btn-badge')).toHaveTextContent('3');
  });

  it('caps the badge at "9+" past 9', () => {
    render(
      <IconButton
        testID="btn"
        icon="bell"
        onPress={jest.fn()}
        accessibilityLabel="Alerts"
        badgeCount={42}
      />,
    );

    expect(screen.getByTestId('btn-badge')).toHaveTextContent('9+');
  });
});

describe('IconButton touch target', () => {
  it('keeps its 36pt appearance but extends the touch area to the 44pt minimum', () => {
    render(
      <IconButton testID="btn" icon="arrow-left" onPress={jest.fn()} accessibilityLabel="Back" />,
    );

    const btn = screen.getByTestId('btn');
    const style = StyleSheet.flatten(btn.props.style);
    expect(style.width).toBe(36);
    expect(style.height).toBe(36);

    const slop = btn.props.hitSlop as { top: number; bottom: number; left: number; right: number };
    expect(style.height + slop.top + slop.bottom).toBeGreaterThanOrEqual(44);
    expect(style.width + slop.left + slop.right).toBeGreaterThanOrEqual(44);
  });
});
