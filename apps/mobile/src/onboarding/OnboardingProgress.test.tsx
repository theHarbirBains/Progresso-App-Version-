import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { OnboardingProgress } from './OnboardingProgress';

describe('OnboardingProgress', () => {
  it('renders a bar per part, each filled as far as its steps have gone', () => {
    render(
      <OnboardingProgress
        testID="progress"
        sections={[
          { steps: 6, done: 6 },
          { steps: 4, done: 1 },
          { steps: 3, done: 0 },
        ]}
      />,
    );

    const width = (i: number) =>
      StyleSheet.flatten(
        screen.getByTestId(`progress-section-${i}-fill`, { includeHiddenElements: true }).props
          .style,
      ).width;
    expect(width(0)).toBe('100%');
    expect(width(1)).toBe('25%');
    expect(width(2)).toBe('0%');
    expect(screen.queryByTestId('progress-section-3', { includeHiddenElements: true })).toBeNull();
  });
});
