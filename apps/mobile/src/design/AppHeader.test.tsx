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

  it('renders leftAction2 next to a primary leftAction and calls it when pressed', () => {
    const onPress = jest.fn();
    render(
      <AppHeader
        title="Feed"
        leftAction={{ icon: 'menu', onPress: jest.fn(), accessibilityLabel: 'Open menu' }}
        leftAction2={{ icon: 'search', onPress, accessibilityLabel: 'Find people', testID: 'header-search' }}
      />,
    );

    fireEvent.press(screen.getByTestId('header-search'));

    expect(onPress).toHaveBeenCalled();
  });

  it('ignores leftAction2 when there is no primary left action to sit next to', () => {
    render(
      <AppHeader
        title="Feed"
        leftAction2={{
          icon: 'search',
          onPress: jest.fn(),
          accessibilityLabel: 'Find people',
          testID: 'header-search',
        }}
      />,
    );

    expect(screen.queryByTestId('header-search')).toBeNull();
  });

  it('renders rightAction2 after rightAction and calls it when pressed -- no primary right action required', () => {
    const onPress = jest.fn();
    render(
      <AppHeader
        title="Feed"
        rightAction2={{ icon: 'bell', onPress, accessibilityLabel: 'Alerts', testID: 'header-bell' }}
      />,
    );

    fireEvent.press(screen.getByTestId('header-bell'));

    expect(onPress).toHaveBeenCalled();
  });

  it('passes badgeCount through to a right action', () => {
    render(
      <AppHeader
        title="Feed"
        rightAction2={{
          icon: 'bell',
          onPress: jest.fn(),
          accessibilityLabel: 'Alerts',
          testID: 'header-bell',
          badgeCount: 2,
        }}
      />,
    );

    expect(screen.getByTestId('header-bell-badge')).toHaveTextContent('2');
  });

  it('renders both leftAction2 and rightAction2 together, symmetric on each side', () => {
    render(
      <AppHeader
        title="Feed"
        leftAction={{ icon: 'menu', onPress: jest.fn(), accessibilityLabel: 'Open menu' }}
        leftAction2={{ icon: 'search', onPress: jest.fn(), accessibilityLabel: 'Find people', testID: 'header-search' }}
        rightAction={{ icon: 'plus', onPress: jest.fn(), accessibilityLabel: 'Quick actions', testID: 'header-plus' }}
        rightAction2={{ icon: 'bell', onPress: jest.fn(), accessibilityLabel: 'Alerts', testID: 'header-bell' }}
      />,
    );

    expect(screen.getByTestId('header-search')).toBeTruthy();
    expect(screen.getByTestId('header-plus')).toBeTruthy();
    expect(screen.getByTestId('header-bell')).toBeTruthy();
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
