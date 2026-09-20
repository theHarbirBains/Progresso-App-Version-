import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
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
