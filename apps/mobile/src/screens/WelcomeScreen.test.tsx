import { fireEvent, render, screen } from '@testing-library/react-native';
import { WelcomeScreen } from './WelcomeScreen';

describe('WelcomeScreen', () => {
  it('renders the title, subtitle, and all feature highlights', () => {
    render(<WelcomeScreen onGetStarted={jest.fn()} />);

    expect(screen.getByText('Welcome to Progresso')).toBeTruthy();
    expect(screen.getByText('Your training and nutrition, in one place.')).toBeTruthy();
    expect(screen.getByText('Track workouts and progressive overload')).toBeTruthy();
    expect(screen.getByText('Monitor your progress and PRs')).toBeTruthy();
    expect(screen.getByText('Log nutrition and manage daily goals')).toBeTruthy();
  });

  it('calls onGetStarted when the primary button is pressed', () => {
    const onGetStarted = jest.fn();
    render(<WelcomeScreen onGetStarted={onGetStarted} />);

    fireEvent.press(screen.getByTestId('welcome-get-started'));

    expect(onGetStarted).toHaveBeenCalledTimes(1);
  });

  it('exposes an accessible button role for the primary action', () => {
    render(<WelcomeScreen onGetStarted={jest.fn()} />);

    expect(screen.getByTestId('welcome-get-started').props.accessibilityRole).toBe('button');
  });
});
