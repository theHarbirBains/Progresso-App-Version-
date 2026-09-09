import { fireEvent, render, screen } from '@testing-library/react-native';
import { AddExerciseButton } from './AddExerciseButton';

describe('AddExerciseButton', () => {
  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<AddExerciseButton testID="add-exercise" onPress={onPress} />);

    fireEvent.press(screen.getByTestId('add-exercise'));

    expect(onPress).toHaveBeenCalled();
  });
});
