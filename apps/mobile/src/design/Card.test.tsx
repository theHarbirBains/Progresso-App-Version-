import { StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Card } from './Card';
import { colors, radii } from './theme';

describe('Card', () => {
  it('renders as a plain view when no onPress is given', () => {
    render(
      <Card testID="card">
        <Text>Content</Text>
      </Card>,
    );

    expect(screen.getByTestId('card')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('is pressable and calls onPress when provided', () => {
    const onPress = jest.fn();
    render(
      <Card testID="card" onPress={onPress}>
        <Text>Content</Text>
      </Card>,
    );

    fireEvent.press(screen.getByTestId('card'));

    expect(onPress).toHaveBeenCalled();
  });

  it('defaults to an accessible button role when pressable, and forwards a given label/state', () => {
    render(
      <Card
        testID="card"
        onPress={jest.fn()}
        accessibilityLabel="Start Push workout"
        accessibilityState={{ disabled: true }}
      >
        <Text>Content</Text>
      </Card>,
    );

    const card = screen.getByTestId('card');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toBe('Start Push workout');
    expect(card.props.accessibilityState).toEqual({ disabled: true });
  });

  it('is a flat, opaque surface -- no translucent glass tint underneath', () => {
    render(
      <Card testID="card">
        <Text>Content</Text>
      </Card>,
    );

    expect(screen.queryByTestId('glass-background')).toBeNull();
    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style.backgroundColor).toBe(colors.surfaceRaised);
    expect(style.borderRadius).toBe(radii.xl);
  });

  it('fills solid with the given color for the one hero card on a screen', () => {
    render(
      <Card testID="card" heroColor="#FF6B4A">
        <Text>Content</Text>
      </Card>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style.backgroundColor).toBe('#FF6B4A');
  });
});
