import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { BottomNavBar } from './BottomNavBar';

const baseProps = {
  workoutAccentColor: '#2F80FF',
  nutritionAccentColor: '#10B981',
  neutralAccentColor: '#2F80FF',
  paddingBottom: 8,
  onNavigateFeed: jest.fn(),
  onNavigateTrain: jest.fn(),
  onNavigateNutrition: jest.fn(),
  onNavigateProgress: jest.fn(),
  onNavigateYou: jest.fn(),
};

describe('BottomNavBar', () => {
  it('renders all 5 destinations', () => {
    render(<BottomNavBar {...baseProps} active="feed" />);

    expect(screen.getByTestId('bottom-nav-feed')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-train')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-nutrition')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-progress')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-you')).toBeTruthy();
  });

  it('marks the active destination as selected', () => {
    render(<BottomNavBar {...baseProps} active="train" />);

    expect(screen.getByTestId('bottom-nav-train').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('bottom-nav-feed').props.accessibilityState.selected).toBe(false);
  });

  it('calls the right callback for each destination', () => {
    const props = { ...baseProps };
    render(<BottomNavBar {...props} active="feed" />);

    fireEvent.press(screen.getByTestId('bottom-nav-train'));
    expect(props.onNavigateTrain).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('bottom-nav-nutrition'));
    expect(props.onNavigateNutrition).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('bottom-nav-progress'));
    expect(props.onNavigateProgress).toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('bottom-nav-you'));
    expect(props.onNavigateYou).toHaveBeenCalled();
  });

  // There is no Workout/Nutrition toggle any more -- every tab always shows
  // the same label/icon, regardless of where you currently are.
  it('always shows the same fixed labels, in both directions', () => {
    const { rerender } = render(<BottomNavBar {...baseProps} active="feed" />);
    expect(screen.getByTestId('bottom-nav-train')).toHaveTextContent(/Workouts/);
    expect(screen.getByTestId('bottom-nav-nutrition')).toHaveTextContent(/Nutrition/);

    rerender(<BottomNavBar {...baseProps} active="nutrition" />);
    expect(screen.getByTestId('bottom-nav-train')).toHaveTextContent(/Workouts/);
    expect(screen.getByTestId('bottom-nav-nutrition')).toHaveTextContent(/Nutrition/);
  });

  it("renders Train's active tab in the Workout accent and Nutrition's in the Nutrition accent", () => {
    const { rerender } = render(<BottomNavBar {...baseProps} active="train" />);
    let label = within(screen.getByTestId('bottom-nav-train')).getByText('Workouts');
    expect(StyleSheet.flatten(label.props.style).color).toBe('#2F80FF');

    rerender(<BottomNavBar {...baseProps} active="nutrition" />);
    label = within(screen.getByTestId('bottom-nav-nutrition')).getByText('Nutrition');
    expect(StyleSheet.flatten(label.props.style).color).toBe('#10B981');
  });

  it('renders a mode-agnostic tab (Feed/Progress/You) in the given neutral accent when active', () => {
    render(<BottomNavBar {...baseProps} active="feed" neutralAccentColor="#10B981" />);

    const label = within(screen.getByTestId('bottom-nav-feed')).getByText('Feed');
    expect(StyleSheet.flatten(label.props.style).color).toBe('#10B981');
  });

  it('leaves an inactive tab in the neutral secondary colour, regardless of accent', () => {
    render(<BottomNavBar {...baseProps} active="feed" />);

    const label = within(screen.getByTestId('bottom-nav-train')).getByText('Workouts');
    expect(StyleSheet.flatten(label.props.style).color).not.toBe('#2F80FF');
  });

  // Regression guard: this bar is mounted once at the app-shell level
  // (App.tsx) as a normal in-flow sibling of the navigator, not an
  // absolutely-positioned overlay a screen has to leave room for itself.
  it('lays out in normal flow, not as an absolutely-positioned overlay', () => {
    render(<BottomNavBar {...baseProps} active="feed" />);

    const bar = screen.getByTestId('bottom-nav-bar');
    expect(StyleSheet.flatten(bar.props.style).position).not.toBe('absolute');
  });
});

describe('BottomNavBar accessibility and touch targets', () => {
  it('is exposed as a tab list whose destinations are tabs with clear names', () => {
    render(<BottomNavBar {...baseProps} active="train" />);

    expect(screen.getByTestId('bottom-nav-bar').props.accessibilityRole).toBe('tablist');
    for (const [id, name] of [
      ['bottom-nav-feed', 'Feed'],
      ['bottom-nav-train', 'Workouts'],
      ['bottom-nav-nutrition', 'Nutrition'],
      ['bottom-nav-progress', 'Progress'],
      ['bottom-nav-you', 'You'],
    ] as const) {
      const tab = screen.getByTestId(id);
      expect(tab.props.accessibilityRole).toBe('tab');
      expect(tab.props.accessibilityLabel).toBe(name);
    }
  });

  it('gives every tab at least the 44pt minimum touch height and a 56pt width', () => {
    render(<BottomNavBar {...baseProps} active="feed" />);

    for (const id of [
      'bottom-nav-feed',
      'bottom-nav-train',
      'bottom-nav-nutrition',
      'bottom-nav-progress',
      'bottom-nav-you',
    ]) {
      const style = StyleSheet.flatten(screen.getByTestId(id).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(56);
    }
  });

  it('accepts an accent change without remounting or crashing', () => {
    const { rerender } = render(<BottomNavBar {...baseProps} active="feed" />);

    rerender(<BottomNavBar {...baseProps} active="feed" neutralAccentColor="#10B981" />);

    const label = within(screen.getByTestId('bottom-nav-feed')).getByText('Feed');
    expect(StyleSheet.flatten(label.props.style).color).toBe('#10B981');
  });
});

describe('BottomNavBar in the Trainer Workspace', () => {
  const trainerTabs = {
    onNavigateClients: jest.fn(),
    onNavigateActivity: jest.fn(),
    onNavigateSessions: jest.fn(),
  };

  it("shows the workspace's three tabs -- Clients, Activity, Sessions -- in place of the five", () => {
    render(<BottomNavBar {...baseProps} active="clients" trainerTabs={trainerTabs} />);

    expect(screen.getByTestId('bottom-nav-clients')).toHaveTextContent(/Clients/);
    expect(screen.getByTestId('bottom-nav-activity')).toHaveTextContent(/Activity/);
    expect(screen.getByTestId('bottom-nav-sessions')).toHaveTextContent(/Sessions/);
    for (const id of [
      'bottom-nav-feed',
      'bottom-nav-train',
      'bottom-nav-nutrition',
      'bottom-nav-progress',
      'bottom-nav-you',
    ]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it('opens each tab, and marks the current one in the accent', () => {
    render(<BottomNavBar {...baseProps} active="sessions" trainerTabs={trainerTabs} />);

    expect(screen.getByTestId('bottom-nav-sessions').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('bottom-nav-clients').props.accessibilityState.selected).toBe(false);
    const label = within(screen.getByTestId('bottom-nav-sessions')).getByText('Sessions');
    expect(StyleSheet.flatten(label.props.style).color).toBe('#2F80FF');

    fireEvent.press(screen.getByTestId('bottom-nav-clients'));
    expect(trainerTabs.onNavigateClients).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('bottom-nav-activity'));
    expect(trainerTabs.onNavigateActivity).toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('bottom-nav-sessions'));
    expect(trainerTabs.onNavigateSessions).toHaveBeenCalled();
  });

  it("draws the bar's top edge in the accent -- only in the Trainer Workspace", () => {
    const { rerender } = render(
      <BottomNavBar {...baseProps} active="clients" trainerTabs={trainerTabs} />,
    );
    const edge = () => StyleSheet.flatten(screen.getByTestId('bottom-nav-bar').props.style);
    expect(edge().borderTopColor).toBe('#2F80FF');

    rerender(<BottomNavBar {...baseProps} active="feed" />);
    expect(edge().borderTopColor).not.toBe('#2F80FF');
  });
});
