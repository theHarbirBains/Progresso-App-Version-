import { fireEvent, render, screen } from '@testing-library/react-native';
import { OnboardingOptionCard } from './OnboardingOptionCard';

describe('OnboardingOptionCard', () => {
  it('renders the label and optional description', () => {
    render(
      <OnboardingOptionCard
        testID="card"
        label="Beginner"
        description="New to training"
        selected={false}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('Beginner')).toBeTruthy();
    expect(screen.getByText('New to training')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(
      <OnboardingOptionCard testID="card" label="Beginner" selected={false} onPress={onPress} />,
    );

    fireEvent.press(screen.getByTestId('card'));

    expect(onPress).toHaveBeenCalled();
  });

  it('reflects selected state via accessibilityState', () => {
    render(
      <OnboardingOptionCard testID="card" label="Beginner" selected={true} onPress={jest.fn()} />,
    );

    expect(screen.getByTestId('card').props.accessibilityState.selected).toBe(true);
  });
});
