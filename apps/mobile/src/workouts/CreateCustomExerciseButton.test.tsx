import { fireEvent, render, screen } from '@testing-library/react-native';
import { CreateCustomExerciseButton } from './CreateCustomExerciseButton';

describe('CreateCustomExerciseButton', () => {
  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<CreateCustomExerciseButton testID="create-custom" onPress={onPress} />);

    fireEvent.press(screen.getByTestId('create-custom'));

    expect(onPress).toHaveBeenCalled();
  });
});
