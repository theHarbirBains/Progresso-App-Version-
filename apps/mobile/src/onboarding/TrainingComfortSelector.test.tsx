import { fireEvent, render, screen } from '@testing-library/react-native';
import { WorkoutPreferenceSelector } from './WorkoutPreferenceSelector';

describe('WorkoutPreferenceSelector', () => {
  it('renders both training-style options with their descriptions', () => {
    render(<WorkoutPreferenceSelector testID="style" value={null} onChange={jest.fn()} />);

    expect(screen.getByTestId('style-guided')).toBeTruthy();
    expect(screen.getByTestId('style-build_your_own')).toBeTruthy();
    expect(screen.getByText(/complete control/i)).toBeTruthy();
  });

  it('calls onChange with the pressed style', () => {
    const onChange = jest.fn();
    render(<WorkoutPreferenceSelector testID="style" value={null} onChange={onChange} />);

    fireEvent.press(screen.getByTestId('style-build_your_own'));

    expect(onChange).toHaveBeenCalledWith('build_your_own');
  });
});
