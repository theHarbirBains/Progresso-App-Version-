import { render, screen } from '@testing-library/react-native';
import { OnboardingProgress } from './OnboardingProgress';

describe('OnboardingProgress', () => {
  it('renders one dot per step', () => {
    render(<OnboardingProgress testID="progress" currentIndex={2} totalSteps={5} />);

    for (let i = 0; i < 5; i++) {
      expect(screen.getByTestId(`progress-dot-${i}`)).toBeTruthy();
    }
  });
});
