import { fireEvent, render, screen } from '@testing-library/react-native';
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
