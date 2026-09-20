import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { BottomNavBar } from './BottomNavBar';

const baseProps = {
  mode: 'workout' as const,
  accentColor: '#2F80FF',
  onAccentColor: '#000000',
  paddingBottom: 8,
  onNavigateHome: jest.fn(),
  onNavigateWorkouts: jest.fn(),
  onNavigateProgress: jest.fn(),
  onNavigateProfile: jest.fn(),
  onPressPlus: jest.fn(),
};

describe('BottomNavBar', () => {
  it('renders all 5 destinations', () => {
    render(<BottomNavBar {...baseProps} active="home" />);

    expect(screen.getByTestId('bottom-nav-home')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-workouts')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-plus')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-progress')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-profile')).toBeTruthy();
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

    fireEvent.press(screen.getByTestId('bottom-nav-profile'));
    expect(props.onNavigateProfile).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('bottom-nav-plus'));
    expect(props.onPressPlus).toHaveBeenCalled();
  });

  it('shows the Workout-mode labels by default', () => {
    render(<BottomNavBar {...baseProps} active="home" mode="workout" />);

    expect(screen.getByTestId('bottom-nav-workouts')).toHaveTextContent(/Workouts/);
    expect(screen.getByTestId('bottom-nav-progress')).toHaveTextContent(/Progress/);
  });

  // The bug this guards: the global bar used to always show Workout-mode
  // labels/colors, even on Nutrition-mode screens (FoodLibrary, FoodSearch,
  // NutritionGoals) -- it never reflected Nutrition mode at all. `mode`
  // (driven by App.tsx's route-derived backgroundMode) now mirrors
  // Dashboard's own copy of this bar (DashboardScreen.tsx): Workouts->Food,
  // Progress->Goals, with matching icon swaps. accentColor/onAccentColor are
  // supplied by the caller (App.tsx picks the Nutrition accent theme when
  // backgroundMode is 'nutrition'), so the whole bar -- including the center
  // "+" fill and the active tab's icon/label -- turns green without this
  // component needing to know about accent themes itself.
  it("shows the Nutrition-mode labels ('Food'/'Goals') when mode is nutrition", () => {
    render(<BottomNavBar {...baseProps} active="home" mode="nutrition" accentColor="#10B981" />);

    expect(screen.getByTestId('bottom-nav-workouts')).toHaveTextContent(/Food/);
    expect(screen.queryByText('Workouts')).toBeNull();
    expect(screen.getByTestId('bottom-nav-progress')).toHaveTextContent(/Goals/);
    expect(screen.queryByText('Progress')).toBeNull();
  });

  it('renders the active tab in whatever accentColor the caller passes, following the current mode theme', () => {
    render(<BottomNavBar {...baseProps} active="home" mode="nutrition" accentColor="#10B981" />);

    const label = within(screen.getByTestId('bottom-nav-home')).getByText('Home');
    expect(StyleSheet.flatten(label.props.style).color).toBe('#10B981');
  });

  // Regression guard: this bar is now mounted once at the app-shell level
  // (App.tsx) as a normal in-flow sibling of the navigator, not an
  // absolutely-positioned overlay a screen has to leave room for itself --
  // see the navigation architecture change that made it persistent.
  it('lays out in normal flow, not as an absolutely-positioned overlay', () => {
    render(<BottomNavBar {...baseProps} active="home" />);

    const bar = screen.getByTestId('bottom-nav-bar');
    expect(StyleSheet.flatten(bar.props.style).position).not.toBe('absolute');
  });
});
