import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BubbleMenu, BubbleMenuRow } from './BubbleMenu';

describe('BubbleMenu', () => {
  it('renders children when visible', () => {
    render(
      <BubbleMenu testID="menu" visible onClose={jest.fn()}>
        <Text>Menu content</Text>
      </BubbleMenu>,
    );

    expect(screen.getByText('Menu content')).toBeTruthy();
  });

  it('does not render its content when visible=false', () => {
    render(
      <BubbleMenu testID="menu" visible={false} onClose={jest.fn()}>
        <Text>Menu content</Text>
      </BubbleMenu>,
    );

    expect(screen.queryByText('Menu content')).toBeNull();
  });

  it('calls onClose when the backdrop is pressed', () => {
    const onClose = jest.fn();
    render(
      <BubbleMenu testID="menu" visible onClose={onClose}>
        <Text>Menu content</Text>
      </BubbleMenu>,
    );

    fireEvent.press(screen.getByTestId('menu-backdrop'));

    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when the menu content itself is pressed', () => {
    const onClose = jest.fn();
    render(
      <BubbleMenu testID="menu" visible onClose={onClose}>
        <Text>Menu content</Text>
      </BubbleMenu>,
    );

    fireEvent.press(screen.getByTestId('menu-content'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('BubbleMenuRow', () => {
  it('renders its label and calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<BubbleMenuRow testID="row" icon="activity" label="Start Workout" onPress={onPress} />);

    expect(screen.getByText('Start Workout')).toBeTruthy();

    fireEvent.press(screen.getByTestId('row'));

    expect(onPress).toHaveBeenCalled();
  });
});
