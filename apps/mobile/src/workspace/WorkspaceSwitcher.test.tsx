import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { WorkspaceContext, type Workspace } from './WorkspaceContext';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ displayName: 'Harbir Bains', avatarUrl: null }),
}));

function renderSwitcher(workspace: Workspace, isTrainer = true, switchTo = jest.fn()) {
  render(
    <WorkspaceContext.Provider value={{ workspace, isTrainer, switchTo }}>
      <WorkspaceSwitcher />
    </WorkspaceContext.Provider>,
  );
  return switchTo;
}

describe('WorkspaceSwitcher', () => {
  it('shows nothing to someone who is not a trainer -- there is nothing to switch to', () => {
    renderSwitcher('personal', false);
    expect(screen.queryByTestId('workspace-switcher')).toBeNull();
  });

  it('shows nothing outside the app', () => {
    render(<WorkspaceSwitcher />);
    expect(screen.queryByTestId('workspace-switcher')).toBeNull();
  });

  it('shows the workspace you are in, as a pill', () => {
    renderSwitcher('personal');
    const pill = screen.getByTestId('workspace-switcher');
    expect(pill).toHaveTextContent(/My Workspace/);
    expect(pill).toHaveTextContent(/Personal/);
    expect(pill.props.accessibilityLabel).toBe('My Workspace, Personal. Switch workspace');
  });

  it('drops a panel offering just the two workspaces, the current one checked', () => {
    renderSwitcher('personal');
    fireEvent.press(screen.getByTestId('workspace-switcher'));

    const panel = screen.getByTestId('workspace-switcher-panel');
    expect(panel).toHaveTextContent(/Switch Workspace/);
    expect(
      within(panel).getByTestId('workspace-switcher-panel-personal').props.accessibilityState,
    ).toEqual({ checked: true });
    expect(
      within(panel).getByTestId('workspace-switcher-panel-trainer').props.accessibilityState,
    ).toEqual({ checked: false });
    expect(panel).not.toHaveTextContent(/Create New Workspace/);
  });

  it('switches to the workspace you pick', () => {
    const switchTo = renderSwitcher('personal');
    fireEvent.press(screen.getByTestId('workspace-switcher'));
    fireEvent.press(screen.getByTestId('workspace-switcher-panel-trainer'));

    expect(switchTo).toHaveBeenCalledWith('trainer');
  });

  it("doesn't switch when you pick the one you're already in", () => {
    const switchTo = renderSwitcher('trainer');
    expect(screen.getByTestId('workspace-switcher')).toHaveTextContent(/Trainer Workspace/);
    fireEvent.press(screen.getByTestId('workspace-switcher'));
    fireEvent.press(screen.getByTestId('workspace-switcher-panel-trainer'));

    expect(switchTo).not.toHaveBeenCalled();
  });
});
