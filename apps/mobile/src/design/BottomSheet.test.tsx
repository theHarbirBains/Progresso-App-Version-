import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BottomSheet, swipeDismisses } from './BottomSheet';

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

  // Regression guard for "keyboard covers the lower portion of the sheet":
  // the whole backdrop+sheet must sit inside a KeyboardAvoidingView so the
  // bottom-anchored sheet gets pushed up above the keyboard, and the sheet
  // itself needs a height cap so a scrollable child (e.g. ExerciseFormScreen)
  // has an actual bounded box to scroll a focused field into view within.
  it('wraps the sheet in a KeyboardAvoidingView with a platform-appropriate behavior', () => {
    render(
      <BottomSheet testID="sheet" visible onClose={jest.fn()}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );

    const avoider = screen.UNSAFE_getByType(KeyboardAvoidingView);
    expect(avoider.props.behavior).toBe(Platform.OS === 'ios' ? 'padding' : 'height');
  });

  it('caps the sheet height so its content can scroll instead of overflowing off-screen', () => {
    render(
      <BottomSheet testID="sheet" visible onClose={jest.fn()}>
        <Text>Sheet content</Text>
      </BottomSheet>,
    );

    const content = screen.getByTestId('sheet-content');
    expect(StyleSheet.flatten(content.props.style).maxHeight).toBe('90%');
  });
});

describe('BottomSheet -- swiped down to tuck away', () => {
  it('has a grabber only where it can be swiped away', () => {
    const { rerender } = render(
      <BottomSheet visible onClose={jest.fn()} testID="sheet" swipeToDismiss>
        <Text>Inside</Text>
      </BottomSheet>,
    );
    expect(screen.getByTestId('sheet-grabber', { includeHiddenElements: true })).toBeTruthy();
    rerender(
      <BottomSheet visible onClose={jest.fn()} testID="sheet">
        <Text>Inside</Text>
      </BottomSheet>,
    );
    expect(screen.queryByTestId('sheet-grabber', { includeHiddenElements: true })).toBeNull();
  });

  it('still closes from its backdrop, and a tap on the sheet itself never does', () => {
    const onClose = jest.fn();
    render(
      <BottomSheet visible onClose={onClose} testID="sheet" swipeToDismiss>
        <Text>Inside</Text>
      </BottomSheet>,
    );
    fireEvent.press(screen.getByText('Inside'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when pulled a good way down or flicked, and springs back otherwise', () => {
    expect(swipeDismisses(140, 0.1, 500)).toBe(true);
    expect(swipeDismisses(40, 1.4, 500)).toBe(true);
    expect(swipeDismisses(40, 0.2, 500)).toBe(false);
    expect(swipeDismisses(10, 2, 500)).toBe(false);
    // A short sheet needs less of a pull.
    expect(swipeDismisses(70, 0, 200)).toBe(true);
  });
});
