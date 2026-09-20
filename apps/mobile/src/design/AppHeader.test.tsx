import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('renders title and subtitle', () => {
    render(<AppHeader title="Workouts" subtitle="Your history" />);

    expect(screen.getByText('Workouts')).toBeTruthy();
    expect(screen.getByText('Your history')).toBeTruthy();
  });

  // The title sits in a flexible column between two equal-width side slots
  // (a real left action or an equal-width empty spacer, same on the right),
  // so that column is already centered in the row -- but the text itself
  // still needs textAlign: 'center', or it renders flush to the column's
  // left edge instead of the middle of the screen.
  it('centers the title and subtitle text, not just the column that holds them', () => {
    render(<AppHeader title="Workouts" subtitle="Your history" />);

    expect(StyleSheet.flatten(screen.getByText('Workouts').props.style).textAlign).toBe('center');
    expect(StyleSheet.flatten(screen.getByText('Your history').props.style).textAlign).toBe(
      'center',
    );
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
