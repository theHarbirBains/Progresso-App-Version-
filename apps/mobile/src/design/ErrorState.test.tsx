import { fireEvent, render, screen } from '@testing-library/react-native';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders the default title and given message', () => {
    render(<ErrorState testID="error" message="Failed to load workouts" />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByTestId('error')).toHaveTextContent('Failed to load workouts');
  });

  it('renders a custom title when given', () => {
    render(<ErrorState title="No connection" message="Check your network" />);

    expect(screen.getByText('No connection')).toBeTruthy();
  });

  it('does not render a Retry action when onRetry is omitted', () => {
    render(<ErrorState message="Failed" />);

    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('calls onRetry when Retry is pressed', () => {
    const onRetry = jest.fn();
    render(<ErrorState testID="error" message="Failed" onRetry={onRetry} />);

    fireEvent.press(screen.getByTestId('error-retry'));

    expect(onRetry).toHaveBeenCalled();
  });

  it('shows a spinner instead of the Retry label while retrying', () => {
    render(<ErrorState testID="error" message="Failed" onRetry={jest.fn()} retrying />);

    expect(screen.queryByText('Retry')).toBeNull();
    expect(screen.getByTestId('error-retry').props.accessibilityState.disabled).toBe(true);
  });
});
