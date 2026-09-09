import { fireEvent, render, screen } from '@testing-library/react-native';
import { BottomNavBar } from './BottomNavBar';

const baseProps = {
  accentColor: '#2F80FF',
  onAccentColor: '#000000',
  paddingBottom: 8,
  onNavigateHome: jest.fn(),
  onNavigateWorkouts: jest.fn(),
  onNavigateProgress: jest.fn(),
  onNavigateSocial: jest.fn(),
  onPressPlus: jest.fn(),
};

describe('BottomNavBar', () => {
  it('renders all 5 destinations', () => {
    render(<BottomNavBar {...baseProps} active="home" />);

    expect(screen.getByTestId('bottom-nav-home')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-workouts')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-plus')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-progress')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-social')).toBeTruthy();
  });

  it('marks the active destination as selected', () => {
    render(<BottomNavBar {...baseProps} active="workouts" />);

    expect(screen.getByTestId('bottom-nav-workouts').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('bottom-nav-home').props.accessibilityState.selected).toBe(false);
  });

  it('calls the right callback for each destination', () => {
    const props = { ...baseProps };
    render(<BottomNavBar {...props} active="home" />);

    fireEvent.press(screen.getByTestId('bottom-nav-workouts'));
    expect(props.onNavigateWorkouts).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('bottom-nav-progress'));
    expect(props.onNavigateProgress).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('bottom-nav-social'));
    expect(props.onNavigateSocial).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('bottom-nav-plus'));
    expect(props.onPressPlus).toHaveBeenCalled();
  });
});
