import { fireEvent, render, screen } from '@testing-library/react-native';
import { TextInput } from './TextInput';

describe('TextInput', () => {
  it('renders label, placeholder, and value', () => {
    render(
      <TextInput
        testID="field"
        label="Email"
        placeholder="you@example.com"
        value="a@b.com"
        onChangeText={jest.fn()}
      />,
    );

    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByTestId('field').props.value).toBe('a@b.com');
    expect(screen.getByTestId('field').props.placeholder).toBe('you@example.com');
  });

  it('calls onChangeText as the user types', () => {
    const onChangeText = jest.fn();
    render(<TextInput testID="field" value="" onChangeText={onChangeText} />);

    fireEvent.changeText(screen.getByTestId('field'), 'hello');

    expect(onChangeText).toHaveBeenCalledWith('hello');
  });

  it('shows helper text when there is no error', () => {
    render(<TextInput testID="field" value="" onChangeText={jest.fn()} helperText="Optional" />);

    expect(screen.getByText('Optional')).toBeTruthy();
  });

  it('shows error text instead of helper text when both are given', () => {
    render(
      <TextInput
        testID="field"
        value=""
        onChangeText={jest.fn()}
        helperText="Optional"
        error="Required"
      />,
    );

    expect(screen.getByTestId('field-error')).toHaveTextContent('Required');
    expect(screen.queryByText('Optional')).toBeNull();
  });

  it('is not editable when disabled', () => {
    render(<TextInput testID="field" value="" onChangeText={jest.fn()} disabled />);

    expect(screen.getByTestId('field').props.editable).toBe(false);
  });
});
