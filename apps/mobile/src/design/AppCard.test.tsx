import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppCard } from './AppCard';

describe('AppCard', () => {
  it('renders as a plain view when no onPress is given', () => {
    render(
      <AppCard testID="card">
        <Text>Content</Text>
      </AppCard>,
    );

    expect(screen.getByTestId('card')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('is pressable and calls onPress when provided', () => {
    const onPress = jest.fn();
    render(
      <AppCard testID="card" onPress={onPress}>
        <Text>Content</Text>
      </AppCard>,
    );

    fireEvent.press(screen.getByTestId('card'));

    expect(onPress).toHaveBeenCalled();
  });

  it('defaults to an accessible button role when pressable, and forwards a given label/state', () => {
    render(
      <AppCard
        testID="card"
        onPress={jest.fn()}
        accessibilityLabel="Start Push workout"
        accessibilityState={{ disabled: true }}
      >
        <Text>Content</Text>
      </AppCard>,
    );

    const card = screen.getByTestId('card');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toBe('Start Push workout');
    expect(card.props.accessibilityState).toEqual({ disabled: true });
  });
});
