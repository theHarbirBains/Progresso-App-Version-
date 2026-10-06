import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { claimTrainerHistory } from '../lib/api';
import { TrainerClaimScreen } from './TrainerClaimScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  claimTrainerHistory: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockClaim = claimTrainerHistory as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };

function renderScreen() {
  return render(<TrainerClaimScreen navigation={navigation} route={{} as never} />);
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' } });
  mockClaim.mockReset();
  mockGoBack.mockClear();
});

describe('TrainerClaimScreen', () => {
  it('links the history with the code, ignoring case and the dash, and says what happened', async () => {
    mockClaim.mockResolvedValue({ workouts: 3 });
    const alert = jest.spyOn(Alert, 'alert');
    renderScreen();

    fireEvent.changeText(screen.getByTestId('trainer-claim-code-input'), ' abcd-2345 ');
    fireEvent.press(screen.getByTestId('trainer-claim-submit'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(mockClaim).toHaveBeenCalledWith('token-1', 'abcd-2345');
    expect(alert).toHaveBeenCalledWith(
      'History linked',
      expect.stringContaining('3 workouts are now on your account'),
    );
    alert.mockRestore();
  });

  it('refuses a code that cannot be right before sending anything', () => {
    renderScreen();

    fireEvent.changeText(screen.getByTestId('trainer-claim-code-input'), 'abc');
    fireEvent.press(screen.getByTestId('trainer-claim-submit'));

    expect(mockClaim).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the 8-character code your trainer gave you')).toBeTruthy();
  });

  it('shows the server’s reason when the code is refused, and stays on the screen', async () => {
    mockClaim.mockRejectedValue(
      new Error('That code has expired. Ask your trainer for a new one.'),
    );
    renderScreen();

    fireEvent.changeText(screen.getByTestId('trainer-claim-code-input'), 'ABCD2345');
    fireEvent.press(screen.getByTestId('trainer-claim-submit'));

    expect(await screen.findByText(/That code has expired/)).toBeTruthy();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
