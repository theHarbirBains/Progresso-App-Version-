import { fireEvent, render, screen } from '@testing-library/react-native';
import { PermissionStep } from './PermissionStep';

describe('PermissionStep', () => {
  it('renders the title/description and both actions', () => {
    render(
      <PermissionStep
        testID="apple-health"
        icon="heart"
        title="Apple Health"
        description="Sync your activity"
        connectLabel="Connect Apple Health"
        skipLabel="Not Now"
        onConnect={jest.fn()}
        onSkip={jest.fn()}
      />,
    );

    expect(screen.getByText('Apple Health')).toBeTruthy();
    expect(screen.getByText('Sync your activity')).toBeTruthy();
    expect(screen.getByTestId('apple-health-connect')).toBeTruthy();
    expect(screen.getByTestId('apple-health-skip')).toBeTruthy();
  });

  it('calls onConnect when the primary action is pressed', () => {
    const onConnect = jest.fn();
    render(
      <PermissionStep
        testID="apple-health"
        icon="heart"
        title="t"
        description="d"
        connectLabel="Connect"
        skipLabel="Not Now"
        onConnect={onConnect}
        onSkip={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByTestId('apple-health-connect'));

    expect(onConnect).toHaveBeenCalled();
  });

  it('calls onSkip when Not Now is pressed, and it works exactly like Connect (no gating)', () => {
    const onSkip = jest.fn();
    render(
      <PermissionStep
        testID="apple-health"
        icon="heart"
        title="t"
        description="d"
        connectLabel="Connect"
        skipLabel="Not Now"
        onConnect={jest.fn()}
        onSkip={onSkip}
      />,
    );

    fireEvent.press(screen.getByTestId('apple-health-skip'));

    expect(onSkip).toHaveBeenCalled();
  });
});
