import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from './Text';
import { ChoiceTile } from './ChoiceTile';

describe('ChoiceTile', () => {
  it('shows its content and is one named button', () => {
    const onPress = jest.fn();
    render(
      <ChoiceTile testID="t" onPress={onPress} accessibilityLabel="Maintenance, 2,400 calories">
        <Text>Maintenance</Text>
      </ChoiceTile>,
    );

    const tile = screen.getByTestId('t');
    expect(tile).toHaveTextContent(/Maintenance/);
    expect(tile.props.accessibilityRole).toBe('button');
    expect(tile.props.accessibilityLabel).toBe('Maintenance, 2,400 calories');
    fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says whether it is the chosen one of a set', () => {
    const { rerender } = render(
      <ChoiceTile testID="t" selected={false} onPress={jest.fn()} accessibilityLabel="Male">
        <Text>Male</Text>
      </ChoiceTile>,
    );
    expect(screen.getByTestId('t').props.accessibilityState).toEqual({ selected: false });

    rerender(
      <ChoiceTile testID="t" selected onPress={jest.fn()} accessibilityLabel="Male">
        <Text>Male</Text>
      </ChoiceTile>,
    );
    expect(screen.getByTestId('t').props.accessibilityState).toEqual({ selected: true });
  });

  it('has no chosen state when it only opens something', () => {
    render(
      <ChoiceTile testID="t" onPress={jest.fn()} accessibilityLabel="Edit height">
        <Text>Height</Text>
      </ChoiceTile>,
    );

    expect(screen.getByTestId('t').props.accessibilityState?.selected).toBeUndefined();
  });
});
