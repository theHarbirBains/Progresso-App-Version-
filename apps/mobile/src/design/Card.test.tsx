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

  it('is a flat surface (no glass layer underneath) whose fill lets the background photo show through', () => {
    render(
      <Card testID="card">
        <Text>Content</Text>
      </Card>,
    );

    expect(screen.queryByTestId('glass-background')).toBeNull();
    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    // surfaceRaised (#26211C) at 70%: translucent, not opaque.
    expect(style.backgroundColor).toBe('rgba(38, 33, 28, 0.7)');
    expect(style.borderRadius).toBe(radii.xl);
  });

  it('traces its edge with a warm hairline that takes no layout space', () => {
    render(
      <Card testID="card">
        <Text>Content</Text>
      </Card>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    // The edge is an absolutely positioned overlay, never the card's own border.
    expect(style.borderWidth).toBeUndefined();
    const edge = StyleSheet.flatten(screen.getByTestId('card-edge').props.style);
    expect(edge.position).toBe('absolute');
    expect(edge.borderColor).toBe(colors.glassBorder);
  });

  it('leaves a hero card see-through, so its content sits on the background photo', () => {
    render(
      <Card testID="card" hero>
        <Text>Content</Text>
      </Card>,
    );

    const style = StyleSheet.flatten(screen.getByTestId('card').props.style);
    expect(style.backgroundColor).toBeUndefined();
    expect(style.padding).toBe(16);
    expect(screen.queryByTestId('card-edge')).toBeNull();
    expect(screen.getByText('Content')).toBeTruthy();
  });
});
