import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { claimTrainerHistory } from '../lib/api';
import { AchievementsContext, type AchievementsValue } from '../achievements/achievementsContext';
import { TrainerClaimScreen } from './TrainerClaimScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  claimTrainerHistory: jest.fn(),
}));

const mockRefetchAllTimeStats = jest.fn(async () => true);
jest.mock('../progress/AllTimeStatsProvider', () => ({
  useAllTimeStats: () => ({ refetch: mockRefetchAllTimeStats }),
}));

const mockInvalidateExerciseCache = jest.fn();
jest.mock('../exercises/exerciseQueries', () => ({
  invalidateExerciseCache: (userId: string) => mockInvalidateExerciseCache(userId),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockClaim = claimTrainerHistory as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };

const mockEvaluate = jest.fn(async () => undefined);

function renderScreen() {
  return render(
    <AchievementsContext.Provider
      value={{ evaluate: mockEvaluate } as unknown as AchievementsValue}
    >
      <TrainerClaimScreen navigation={navigation} route={{} as never} />
    </AchievementsContext.Provider>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'user-1' } });
  mockClaim.mockReset();
  mockRefetchAllTimeStats.mockClear();
  mockInvalidateExerciseCache.mockClear();
  mockGoBack.mockClear();
  mockEvaluate.mockClear();
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
    // Their trainer stays linked: nothing to accept.
    expect(alert).toHaveBeenCalledWith('History linked', '3 workouts are now on your account.');
    // The claimed history counts toward their achievements at once.
    expect(mockEvaluate).toHaveBeenCalled();
    // Progress, records and the library show the claimed workouts and exercises at once.
    expect(mockRefetchAllTimeStats).toHaveBeenCalled();
    expect(mockInvalidateExerciseCache).toHaveBeenCalledWith('user-1');
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
    // Nothing moved: nothing read again.
    expect(mockRefetchAllTimeStats).not.toHaveBeenCalled();
  });
});
