import { fireEvent, render, screen } from '@testing-library/react-native';
import { PermissionStep } from './PermissionStep';

describe('PermissionStep', () => {
  it('renders the title/description and both actions', () => {
    render(
      <PermissionStep
        testID="notifications"
        icon="bell"
        title="Stay in the loop"
        description="Get workout reminders"
        connectLabel="Allow"
        skipLabel="Not Now"
        onConnect={jest.fn()}
        onSkip={jest.fn()}
      />,
    );

    expect(screen.getByText('Stay in the loop')).toBeTruthy();
    expect(screen.getByText('Get workout reminders')).toBeTruthy();
    expect(screen.getByTestId('notifications-connect')).toBeTruthy();
    expect(screen.getByTestId('notifications-skip')).toBeTruthy();
  });

  it('calls onConnect when the primary action is pressed', () => {
    const onConnect = jest.fn();
    render(
      <PermissionStep
        testID="notifications"
        icon="bell"
        title="t"
        description="d"
        connectLabel="Allow"
        skipLabel="Not Now"
        onConnect={onConnect}
        onSkip={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('notifications-connect'));

    expect(onConnect).toHaveBeenCalled();
  });

  it('calls onSkip when Not Now is pressed, and it works exactly like Connect (no gating)', () => {
    const onSkip = jest.fn();
    render(
      <PermissionStep
        testID="notifications"
        icon="bell"
        title="t"
        description="d"
        connectLabel="Allow"
        skipLabel="Not Now"
        onConnect={jest.fn()}
        onSkip={onSkip}
      />,
    );

    fireEvent.press(screen.getByTestId('notifications-skip'));

    expect(onSkip).toHaveBeenCalled();
  });

  it('blocks both actions while Connect is busy, so a second tap cannot skip ahead', () => {
    const onConnect = jest.fn();
    const onSkip = jest.fn();
    render(
      <PermissionStep
        testID="notifications"
        icon="bell"
        title="t"
        description="d"
        connectLabel="Allow"
        skipLabel="Not Now"
        onConnect={onConnect}
        onSkip={onSkip}
        connectBusy
      />,
    );

    fireEvent.press(screen.getByTestId('notifications-connect'));
    fireEvent.press(screen.getByTestId('notifications-skip'));

    expect(onConnect).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
    expect(screen.getByTestId('notifications-connect')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ busy: true }),
    );
  });
});
