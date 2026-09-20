import { StyleSheet } from 'react-native';
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

describe('AddExerciseButton -- shared secondary button', () => {
  it('is a labelled, outlined (not filled) 44pt button', () => {
    render(<AddExerciseButton testID="add-exercise" onPress={jest.fn()} />);

    const button = screen.getByTestId('add-exercise');
    expect(button).toHaveTextContent('Add Exercise');
    expect(button.props.accessibilityRole).toBe('button');
    const style = StyleSheet.flatten(button.props.style);
    expect(style.borderWidth).toBe(1);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
});
