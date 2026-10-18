import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { blockUser, reportUser } from '../lib/safetyApi';
import { PersonActionsSheet } from './PersonActionsSheet';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { access_token: 'token-1' } }),
}));

jest.mock('../lib/safetyApi', () => ({
  blockUser: jest.fn(),
  reportUser: jest.fn(),
}));

const mockBlockUser = blockUser as jest.Mock;
const mockReportUser = reportUser as jest.Mock;
const sam = { id: 'user-2', username: 'sam', displayName: 'Sam Lee', avatarUrl: null };

function renderSheet(props: Partial<Parameters<typeof PersonActionsSheet>[0]> = {}) {
  const onClose = jest.fn();
  const onBlocked = jest.fn();
  render(<PersonActionsSheet person={sam} onClose={onClose} onBlocked={onBlocked} {...props} />);
  return { onClose, onBlocked };
}

/** Taps "Block" on the confirmation alert. */
function confirmAlerts() {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.text === 'Block')?.onPress?.();
  });
}

beforeEach(() => {
  mockBlockUser.mockReset().mockResolvedValue({ success: true });
  mockReportUser.mockReset().mockResolvedValue({ id: 'report-1' });
  jest.restoreAllMocks();
});

describe('PersonActionsSheet', () => {
  it('renders nothing without a person', () => {
    render(<PersonActionsSheet person={null} onClose={jest.fn()} onBlocked={jest.fn()} />);
    expect(screen.queryByTestId('person-actions')).toBeNull();
  });

  it('says who it is about, and offers to report or block them', () => {
    renderSheet();
    expect(screen.getByText('Sam Lee')).toBeTruthy();
    expect(screen.getByText('@sam')).toBeTruthy();
    expect(screen.getByTestId('person-actions-report')).toHaveTextContent(/Report Sam Lee/);
    expect(screen.getByTestId('person-actions-block')).toHaveTextContent(/Block Sam Lee/);
  });

  it('reports the workout when opened from one', () => {
    renderSheet({ workoutId: 'w-1' });
    expect(screen.getByTestId('person-actions-report')).toHaveTextContent(/Report Workout/);
  });

  it('blocks only after confirming, then tells the screen and closes', async () => {
    confirmAlerts();
    const { onBlocked, onClose } = renderSheet();

    fireEvent.press(screen.getByTestId('person-actions-block'));

    await waitFor(() => expect(onBlocked).toHaveBeenCalledWith('user-2'));
    expect(mockBlockUser).toHaveBeenCalledWith('token-1', 'user-2');
    expect(onClose).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Block Sam Lee?',
      expect.stringContaining("They won't be told"),
      expect.any(Array),
    );
  });

  it('does nothing when the block is cancelled', () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { onBlocked } = renderSheet();

    fireEvent.press(screen.getByTestId('person-actions-block'));

    expect(mockBlockUser).not.toHaveBeenCalled();
    expect(onBlocked).not.toHaveBeenCalled();
  });

  it('shows why a block failed and keeps the sheet open', async () => {
    confirmAlerts();
    mockBlockUser.mockRejectedValue(new Error('Failed to block this person'));
    const { onBlocked, onClose } = renderSheet();

    fireEvent.press(screen.getByTestId('person-actions-block'));

    expect(await screen.findByTestId('person-actions-error')).toHaveTextContent(
      'Failed to block this person',
    );
    expect(onBlocked).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sends a report once a reason is picked, with the workout and any details', async () => {
    const { onClose } = renderSheet({ workoutId: 'w-1' });

    fireEvent.press(screen.getByTestId('person-actions-report'));
    const send = screen.getByTestId('person-actions-send-report');
    expect(send.props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('person-actions-reason-harassment'));
    fireEvent.changeText(screen.getByTestId('person-actions-details'), '  Abusive comments  ');
    fireEvent.press(screen.getByTestId('person-actions-send-report'));

    expect(await screen.findByTestId('person-actions-reported')).toHaveTextContent(
      "Thanks. We'll look into it.",
    );
    expect(mockReportUser).toHaveBeenCalledWith('token-1', {
      reportedUserId: 'user-2',
      workoutId: 'w-1',
      reason: 'harassment',
      details: 'Abusive comments',
    });

    fireEvent.press(screen.getByTestId('person-actions-done'));
    expect(onClose).toHaveBeenCalled();
  });

  it('reports a person, with no workout or details when none were given', async () => {
    renderSheet();

    fireEvent.press(screen.getByTestId('person-actions-report'));
    fireEvent.press(screen.getByTestId('person-actions-reason-spam'));
    fireEvent.press(screen.getByTestId('person-actions-send-report'));

    await screen.findByTestId('person-actions-reported');
    expect(mockReportUser).toHaveBeenCalledWith('token-1', {
      reportedUserId: 'user-2',
      reason: 'spam',
    });
    // Blocking is still on offer after reporting.
    expect(screen.getByTestId('person-actions-block-after-report')).toBeTruthy();
  });

  it('marks the picked reason for assistive tech', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId('person-actions-report'));
    fireEvent.press(screen.getByTestId('person-actions-reason-spam'));
    expect(screen.getByLabelText('Spam, selected')).toBeTruthy();
  });
});
