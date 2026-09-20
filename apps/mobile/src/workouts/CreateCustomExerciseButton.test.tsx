import { StyleSheet } from 'react-native';
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

describe('CreateCustomExerciseButton -- quiet text action', () => {
  it('reads "Create Custom Exercise" as plain text with no box', () => {
    render(<CreateCustomExerciseButton testID="create-custom" onPress={jest.fn()} />);

    const button = screen.getByTestId('create-custom');
    expect(button).toHaveTextContent('Create Custom Exercise');
    const style = StyleSheet.flatten(button.props.style);
    expect(style.borderWidth).toBeUndefined();
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
});
