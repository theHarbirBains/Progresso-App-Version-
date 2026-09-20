import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { AppSideMenu } from './AppSideMenu';

const baseProps = {
  activeRoute: 'WorkoutHistory' as const,
  onNavigate: jest.fn(),
  onClose: jest.fn(),
  accentColor: '#29E3C7',
};

describe('AppSideMenu', () => {
  it('renders every configured destination, grouped by section', () => {
    render(<AppSideMenu {...baseProps} visible={true} />);

    expect(screen.getByText('PROGRESSO')).toBeTruthy();
    expect(screen.getByText('TRAINING / TOOLS')).toBeTruthy();
    expect(screen.getByText('MORE')).toBeTruthy();

    // No Home entry -- Dashboard is already one tap away via the bottom nav.
    expect(screen.queryByTestId('app-menu-item-Dashboard')).toBeNull();
    expect(screen.getByTestId('app-menu-item-WorkoutHistory')).toHaveTextContent(/Workouts/);
    expect(screen.getByTestId('app-menu-item-ProgressOverview')).toHaveTextContent(/Progress/);
    // Workout mode's menu is workout-only -- no Nutrition or Profile item
    // (Nutrition mode has its own, separate section list; Profile stays
    // reachable via the bottom nav either way).
    expect(screen.queryByTestId('app-menu-item-Nutrition')).toBeNull();
    expect(screen.queryByTestId('app-menu-item-Profile')).toBeNull();
    expect(screen.getByTestId('app-menu-item-WorkoutSplits')).toHaveTextContent(/Workout Splits/);
    expect(screen.getByTestId('app-menu-item-ExerciseLibrary')).toHaveTextContent(
      /Exercise Library/,
    );
    expect(screen.getByTestId('app-menu-item-AccountSettings')).toHaveTextContent(/Settings/);
  });

  it('marks the active route as selected', () => {
    render(<AppSideMenu {...baseProps} visible={true} activeRoute="WorkoutHistory" />);

    expect(
      screen.getByTestId('app-menu-item-WorkoutHistory').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId('app-menu-item-ProgressOverview').props.accessibilityState.selected,
    ).toBe(false);
  });

  it("calls onNavigate with the pressed item's route", () => {
    const onNavigate = jest.fn();
    render(<AppSideMenu {...baseProps} visible={true} onNavigate={onNavigate} />);

    fireEvent.press(screen.getByTestId('app-menu-item-WorkoutHistory'));

    expect(onNavigate).toHaveBeenCalledWith('WorkoutHistory');
  });

  it('calls onClose when the backdrop is pressed', () => {
    const onClose = jest.fn();
    render(<AppSideMenu {...baseProps} visible={true} onClose={onClose} />);

    fireEvent.press(screen.getByTestId('app-menu-backdrop'));

    expect(onClose).toHaveBeenCalled();
  });

  it('does not render a backdrop when closed', () => {
    render(<AppSideMenu {...baseProps} visible={false} />);

    expect(screen.queryByTestId('app-menu-backdrop')).toBeNull();
  });

  it('renders a custom title when given one, in place of the default "Progresso"', () => {
    render(<AppSideMenu {...baseProps} visible={true} title="Progresso · Nutrition" />);

    expect(screen.getByText('Progresso · Nutrition')).toBeTruthy();
    expect(screen.queryByText('Progresso')).toBeNull();
  });

  it('renders a custom section list when given one, in place of APP_MENU_SECTIONS', () => {
    render(
      <AppSideMenu
        {...baseProps}
        visible={true}
        sections={[
          {
            title: 'NUTRITION',
            items: [{ route: 'Nutrition', label: 'Nutrition Home', icon: 'home' }],
          },
        ]}
      />,
    );

    expect(screen.getByText('NUTRITION')).toBeTruthy();
    expect(screen.getByTestId('app-menu-item-Nutrition')).toHaveTextContent(/Nutrition Home/);
    expect(screen.queryByText('PROGRESSO')).toBeNull();
    expect(screen.queryByTestId('app-menu-item-Dashboard')).toBeNull();
  });

  it('renders a comingSoon entry as a labeled, non-navigable row', () => {
    const onNavigate = jest.fn();
    render(
      <AppSideMenu
        {...baseProps}
        visible={true}
        onNavigate={onNavigate}
        sections={[
          {
            title: 'NUTRITION',
            items: [{ label: 'Recipes', icon: 'book-open', comingSoon: true }],
          },
        ]}
      />,
    );

    const row = screen.getByTestId('app-menu-item-Recipes');
    expect(row).toHaveTextContent(/Recipes/);
    expect(row).toHaveTextContent(/Coming Soon/);

    fireEvent.press(row);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('calls onClose on the Android hardware back press while open', () => {
    const onClose = jest.fn();
    const addEventListenerSpy = jest.spyOn(BackHandler, 'addEventListener');

    render(<AppSideMenu {...baseProps} visible={true} onClose={onClose} />);

    const handler = addEventListenerSpy.mock.calls.find(
      ([event]) => event === 'hardwareBackPress',
    )?.[1] as () => boolean;
    expect(handler).toBeDefined();

    const handled = handler();

    expect(onClose).toHaveBeenCalled();
    expect(handled).toBe(true);
  });
});
