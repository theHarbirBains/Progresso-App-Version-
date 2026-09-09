import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BottomSheet } from './BottomSheet';

describe('BottomSheet', () => {
  it('renders children when visible', () => {
    render(
      <BottomSheet testID="sheet" visible onClose={jest.fn()}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );

    expect(screen.getByText('Sheet content')).toBeTruthy();
  });

  it('does not render its content when visible=false', () => {
    render(
      <BottomSheet testID="sheet" visible={false} onClose={jest.fn()}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );

    expect(screen.queryByText('Sheet content')).toBeNull();
  });

  it('calls onClose when the backdrop is pressed', () => {
    const onClose = jest.fn();
    render(
      <BottomSheet testID="sheet" visible onClose={onClose}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );

    fireEvent.press(screen.getByTestId('sheet-backdrop'));

    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose on backdrop press when dismissOnBackdropPress is false', () => {
    const onClose = jest.fn();
    render(
      <BottomSheet testID="sheet" visible onClose={onClose} dismissOnBackdropPress={false}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );

    fireEvent.press(screen.getByTestId('sheet-backdrop'));

    expect(onClose).not.toHaveBeenCalled();
  });
});
