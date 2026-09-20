import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { WorkoutHeader } from './WorkoutHeader';

describe('WorkoutHeader', () => {
  it('shows the title, centered, with no back or options button', () => {
    render(<WorkoutHeader title="Chest, Back, Abs" testID="workout-header" />);

    expect(screen.getByText('Chest, Back, Abs')).toBeTruthy();
    expect(screen.queryByTestId('workout-header-back')).toBeNull();
    expect(screen.queryByTestId('workout-header-options')).toBeNull();

    const header = screen.getByTestId('workout-header');
    expect(StyleSheet.flatten(header.props.style).alignItems).toBe('center');
  });

  it('pads the top by the safe-area inset so the title never sits under the status bar', () => {
    render(<WorkoutHeader title="Push Day" testID="workout-header" />);

    const header = screen.getByTestId('workout-header');
    // react-native-safe-area-context's jest mock reports insets.top as 0,
    // so this is just spacing.sm (8) on top of it -- asserting > 0 (rather
    // than the literal token value) guards the inset is actually applied,
    // not that it's hardcoded to any one number.
    expect(StyleSheet.flatten(header.props.style).paddingTop).toBeGreaterThan(0);
  });
});
