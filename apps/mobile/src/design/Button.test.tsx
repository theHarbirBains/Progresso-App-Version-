import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from './theme';
import { DestructiveButton, PrimaryButton, SecondaryButton, TextButton } from './Button';

describe('Button variants', () => {
  it.each([
    ['PrimaryButton', PrimaryButton],
    ['SecondaryButton', SecondaryButton],
    ['DestructiveButton', DestructiveButton],
    ['TextButton', TextButton],
  ])('%s renders its label and calls onPress when tapped', (_name, Component) => {
    const onPress = jest.fn();
    render(<Component label="Do it" onPress={onPress} testID="btn" />);

    expect(screen.getByText('Do it')).toBeTruthy();
    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).toHaveBeenCalled();
  });

  it.each([
    ['PrimaryButton', PrimaryButton],
    ['SecondaryButton', SecondaryButton],
    ['DestructiveButton', DestructiveButton],
    ['TextButton', TextButton],
  ])('%s does not call onPress when disabled', (_name, Component) => {
    const onPress = jest.fn();
    render(<Component label="Do it" onPress={onPress} disabled testID="btn" />);

    fireEvent.press(screen.getByTestId('btn'));

    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('PrimaryButton accent color', () => {
  it('defaults to the static brand accent when no accentColor is given', () => {
    render(<PrimaryButton label="Do it" onPress={jest.fn()} testID="btn" />);

    const style = StyleSheet.flatten(screen.getByTestId('btn').props.style);
    expect(style.backgroundColor).toBe(colors.accent);
  });

  it("uses the user's own accent color and its contrasting text color when given", () => {
    render(
      <PrimaryButton
        label="Do it"
        onPress={jest.fn()}
        testID="btn"
        accentColor="#FF6600"
        onAccentColor="#000000"
      />,
    );

    const buttonStyle = StyleSheet.flatten(screen.getByTestId('btn').props.style);
    expect(buttonStyle.backgroundColor).toBe('#FF6600');

    const labelStyle = StyleSheet.flatten(screen.getByText('Do it').props.style);
    expect(labelStyle.color).toBe('#000000');
  });

  it('immediately reflects a changed accent color on re-render, without remounting', () => {
    const { rerender } = render(
      <PrimaryButton label="Do it" onPress={jest.fn()} testID="btn" accentColor="#FF6600" />,
    );
    expect(StyleSheet.flatten(screen.getByTestId('btn').props.style).backgroundColor).toBe(
      '#FF6600',
    );

    rerender(
      <PrimaryButton label="Do it" onPress={jest.fn()} testID="btn" accentColor="#00AAFF" />,
    );
    expect(StyleSheet.flatten(screen.getByTestId('btn').props.style).backgroundColor).toBe(
      '#00AAFF',
    );
  });
});
