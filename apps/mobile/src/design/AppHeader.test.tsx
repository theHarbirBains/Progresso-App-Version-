import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('renders title and subtitle', () => {
    render(<AppHeader title="Workouts" subtitle="Your history" />);

    expect(screen.getByText('Workouts')).toBeTruthy();
    expect(screen.getByText('Your history')).toBeTruthy();
  });

  it('renders a Back button and calls onBack when pressed', () => {
    const onBack = jest.fn();
    render(<AppHeader title="Workouts" onBack={onBack} />);

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(onBack).toHaveBeenCalled();
  });

  it('renders no back button when onBack is omitted', () => {
    render(<AppHeader title="Workouts" />);

    expect(screen.queryByTestId('app-header-back')).toBeNull();
  });

  it('renders a custom rightAction and calls it when pressed', () => {
    const onPress = jest.fn();
    render(
      <AppHeader
        title="Workouts"
        rightAction={{
          icon: 'more-horizontal',
          onPress,
          accessibilityLabel: 'Options',
          testID: 'header-options',
        }}
      />,
    );

    fireEvent.press(screen.getByTestId('header-options'));

    expect(onPress).toHaveBeenCalled();
  });

  it('shows a spinner instead of rightAction when loading', () => {
    const onPress = jest.fn();
    render(
      <AppHeader
        title="Workouts"
        loading
        rightAction={{
          icon: 'more-horizontal',
          onPress,
          accessibilityLabel: 'Options',
          testID: 'header-options',
        }}
      />,
    );

    expect(screen.queryByTestId('header-options')).toBeNull();
  });

  it('prefers a custom leftAction over the default Back button', () => {
    const onPress = jest.fn();
    render(
      <AppHeader
        title="Workouts"
        onBack={jest.fn()}
        leftAction={{ icon: 'x', onPress, accessibilityLabel: 'Close', testID: 'header-close' }}
      />,
    );

    expect(screen.queryByTestId('app-header-back')).toBeNull();
    fireEvent.press(screen.getByTestId('header-close'));
    expect(onPress).toHaveBeenCalled();
  });
});
