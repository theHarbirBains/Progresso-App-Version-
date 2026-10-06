import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { addTrainerClient, listTrainerClients, updateTrainerClientProfile } from '../lib/api';
import { TrainerClientFormScreen, validateClientForm } from './TrainerClientFormScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  addTrainerClient: jest.fn(),
  listTrainerClients: jest.fn(),
  updateTrainerClientProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockAddTrainerClient = addTrainerClient as jest.Mock;
const mockListTrainerClients = listTrainerClients as jest.Mock;
const mockUpdate = updateTrainerClientProfile as jest.Mock;

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, replace: mockReplace, goBack: mockGoBack };

const blank = { email: '', name: '', heightText: '', weightText: '', weightUnit: 'kg' as const };

describe('validateClientForm', () => {
  it('needs a valid email and a name to add a new client', () => {
    expect(validateClientForm(blank, true)).toEqual({
      email: 'Enter a valid email address',
      name: 'Enter their name',
    });
    expect(validateClientForm({ ...blank, email: 'sam@example.com', name: 'Sam' }, true)).toEqual(
      {},
    );
  });

  it('does not ask for an email when editing an existing client', () => {
    expect(validateClientForm({ ...blank, name: 'Sam' }, false)).toEqual({});
  });

  it('treats a blank height or weight as not given, but rejects implausible numbers', () => {
    const base = { ...blank, email: 'sam@example.com', name: 'Sam' };
    expect(validateClientForm(base, true)).toEqual({});
    expect(validateClientForm({ ...base, heightText: '0' }, true).height).toBeDefined();
    expect(validateClientForm({ ...base, heightText: '400' }, true).height).toBeDefined();
    expect(validateClientForm({ ...base, weightText: 'abc' }, true).weight).toBeDefined();
    expect(validateClientForm({ ...base, heightText: '180', weightText: '82.5' }, true)).toEqual(
      {},
    );
  });
});

function renderForm(route: unknown) {
  return render(<TrainerClientFormScreen navigation={navigation} route={route as never} />);
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockAddTrainerClient.mockReset();
  mockListTrainerClients.mockReset();
  mockUpdate.mockReset().mockResolvedValue({ ok: true });
  mockNavigate.mockClear();
  mockReplace.mockClear();
  mockGoBack.mockClear();
});

describe('TrainerClientFormScreen', () => {
  it('adds a new client by email, then opens their page once the account is managed', async () => {
    mockAddTrainerClient.mockResolvedValue({
      clientId: 'client-1',
      status: 'active',
      source: 'managed',
    });
    renderForm(undefined);

    fireEvent.changeText(screen.getByTestId('trainer-client-email'), '  Sam@Example.com ');
    fireEvent.changeText(screen.getByTestId('trainer-client-name'), 'Sam');
    fireEvent.changeText(screen.getByTestId('trainer-client-height'), '180');
    fireEvent.changeText(screen.getByTestId('trainer-client-weight'), '82.5');
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    await waitFor(() => expect(mockAddTrainerClient).toHaveBeenCalled());
    expect(mockAddTrainerClient).toHaveBeenCalledWith('token-123', {
      email: 'sam@example.com',
      displayName: 'Sam',
      heightValue: 180,
      heightUnit: 'cm',
      weightValue: 82.5,
      weightUnit: 'kg',
    });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('TrainerClientDetail', {
        clientId: 'client-1',
        clientName: 'Sam',
      }),
    );
  });

  it('tells the trainer a request was sent when the email already has an account', async () => {
    mockAddTrainerClient.mockResolvedValue({
      clientId: 'client-2',
      status: 'pending',
      source: 'linked',
    });
    const alert = jest.spyOn(Alert, 'alert');
    renderForm(undefined);

    fireEvent.changeText(screen.getByTestId('trainer-client-email'), 'ana@example.com');
    fireEvent.changeText(screen.getByTestId('trainer-client-name'), 'Ana');
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(alert).toHaveBeenCalledWith(
      'Request sent',
      'They need to accept it before you can log workouts for them.',
    );
    alert.mockRestore();
  });

  it('saves nothing when the form is not valid, and says what is missing', () => {
    renderForm(undefined);
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    expect(mockAddTrainerClient).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid email address')).toBeTruthy();
  });

  it("edits a managed client's details, loading what is already saved", async () => {
    mockListTrainerClients.mockResolvedValue([
      {
        clientId: 'client-1',
        status: 'active',
        source: 'managed',
        displayName: 'Sam',
        birthday: null,
        heightValue: 180,
        heightUnit: 'cm',
        weightValue: 80,
        weightUnit: 'kg',
      },
    ]);
    renderForm({ params: { clientId: 'client-1' } });

    expect(await screen.findByTestId('trainer-client-weight')).toHaveProp('value', '80');
    fireEvent.changeText(screen.getByTestId('trainer-client-weight'), '81');
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(mockUpdate).toHaveBeenCalledWith('token-123', 'client-1', {
      displayName: 'Sam',
      heightValue: 180,
      heightUnit: 'cm',
      weightValue: 81,
      weightUnit: 'kg',
    });
    expect(mockAddTrainerClient).not.toHaveBeenCalled();
  });
});
