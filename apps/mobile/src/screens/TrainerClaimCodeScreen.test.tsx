import { fireEvent, render, screen } from '@testing-library/react-native';
import { TrainerClaimCodeScreen } from './TrainerClaimCodeScreen';

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: jest.fn() };

function renderScreen() {
  return render(
    <TrainerClaimCodeScreen
      navigation={navigation}
      route={{ params: { code: 'ABCD-2345', clientId: 'client-1', clientName: 'Pat' } } as never}
    />,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
});

describe('TrainerClaimCodeScreen', () => {
  it('shows the code for the client by name, with what to do with it', () => {
    renderScreen();

    expect(screen.getByTestId('trainer-claim-code')).toHaveTextContent('ABCD-2345');
    expect(screen.getByText('For Pat')).toBeTruthy();
    expect(screen.getByText(/works once and for 30 days/)).toBeTruthy();
  });

  it('returns to the client list when done', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('trainer-claim-code-done'));
    expect(mockNavigate).toHaveBeenCalledWith('TrainerClients');
  });
});
