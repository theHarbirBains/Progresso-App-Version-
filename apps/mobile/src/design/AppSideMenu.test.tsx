import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { AppSideMenu } from './AppSideMenu';

const baseProps = {
  activeRoute: 'Dashboard' as const,
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

    expect(screen.getByTestId('app-menu-item-Dashboard')).toHaveTextContent(/Home/);
    expect(screen.getByTestId('app-menu-item-WorkoutHistory')).toHaveTextContent(/Workouts/);
    expect(screen.getByTestId('app-menu-item-ProgressOverview')).toHaveTextContent(/Progress/);
    expect(screen.getByTestId('app-menu-item-Nutrition')).toHaveTextContent(/Nutrition/);
    expect(screen.getByTestId('app-menu-item-Social')).toHaveTextContent(/Social/);
    expect(screen.getByTestId('app-menu-item-WorkoutSplits')).toHaveTextContent(/Workout Splits/);
    expect(screen.getByTestId('app-menu-item-ExerciseLibrary')).toHaveTextContent(
      /Exercise Library/,
    );
    expect(screen.getByTestId('app-menu-item-AccountSettings')).toHaveTextContent(/Settings/);
  });

  it('marks the active route as selected', () => {
    render(<AppSideMenu {...baseProps} visible={true} activeRoute="Dashboard" />);

    expect(screen.getByTestId('app-menu-item-Dashboard').props.accessibilityState.selected).toBe(
      true,
    );
    expect(
      screen.getByTestId('app-menu-item-WorkoutHistory').props.accessibilityState.selected,
    ).toBe(false);
  });

  it("calls onNavigate with the pressed item's route", () => {
    const onNavigate = jest.fn();
    render(<AppSideMenu {...baseProps} visible={true} onNavigate={onNavigate} />);

    fireEvent.press(screen.getByTestId('app-menu-item-Social'));

    expect(onNavigate).toHaveBeenCalledWith('Social');
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
