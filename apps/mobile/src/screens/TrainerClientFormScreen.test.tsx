import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { addTrainerClient, listTrainerClients, updateTrainerClientProfile } from '../lib/api';
import {
  TrainerClientFormScreen,
  validateClientForm,
  type ClientFormValues,
} from './TrainerClientFormScreen';

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

const blank: ClientFormValues = {
  mode: 'username',
  username: '',
  email: '',
  name: '',
  heightText: '',
  weightText: '',
  weightUnit: 'kg',
};

describe('validateClientForm', () => {
  it('needs a valid username to request an existing account', () => {
    expect(validateClientForm(blank, true).username).toBeDefined();
    expect(validateClientForm({ ...blank, username: 'ab' }, true).username).toBeDefined();
    expect(validateClientForm({ ...blank, username: 'sam_lifts' }, true)).toEqual({});
  });

  it('needs a valid email to invite someone, and takes no name', () => {
    expect(validateClientForm({ ...blank, mode: 'email' }, true).email).toBeDefined();
    expect(validateClientForm({ ...blank, mode: 'email', email: 'sam@example.com' }, true)).toEqual(
      {},
    );
  });

  it('does not ask for anything new when editing an existing client', () => {
    expect(validateClientForm({ ...blank, name: 'Sam' }, false)).toEqual({});
  });

  it('rejects implausible height and weight for an invite, and ignores them for a username request', () => {
    const invite = { ...blank, mode: 'email' as const, email: 'sam@example.com' };
    expect(validateClientForm({ ...invite, heightText: '0' }, true).height).toBeDefined();
    expect(validateClientForm({ ...invite, heightText: '400' }, true).height).toBeDefined();
    expect(validateClientForm({ ...invite, weightText: 'abc' }, true).weight).toBeDefined();
    expect(validateClientForm({ ...invite, heightText: '180', weightText: '82.5' }, true)).toEqual(
      {},
    );

    // An existing account's profile belongs to its owner, so details are not checked here.
    expect(
      validateClientForm({ ...blank, username: 'sam_lifts', heightText: '400' }, true),
    ).toEqual({});
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
  it('sends a request to an existing account by username, lower-cased, and says so', async () => {
    mockAddTrainerClient.mockResolvedValue({
      kind: 'request',
      status: 'pending',
      clientId: 'client-2',
    });
    const alert = jest.spyOn(Alert, 'alert');
    renderForm(undefined);

    fireEvent.changeText(screen.getByTestId('trainer-client-username'), '  Sam_Lifts ');
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(mockAddTrainerClient).toHaveBeenCalledWith('token-123', { username: 'sam_lifts' });
    expect(alert).toHaveBeenCalledWith(
      'Request sent',
      'They need to accept it before you can log workouts for them.',
    );
    alert.mockRestore();
  });

  it('opens the client straight away when they are already linked as active', async () => {
    mockAddTrainerClient.mockResolvedValue({
      kind: 'request',
      status: 'active',
      clientId: 'client-3',
    });
    renderForm(undefined);

    fireEvent.changeText(screen.getByTestId('trainer-client-username'), 'sam_lifts');
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('TrainerClientDetail', { clientId: 'client-3' }),
    );
  });

  it('sends an email invite with its details, and gives the same answer whatever the address', async () => {
    mockAddTrainerClient.mockResolvedValue({ kind: 'invite', status: 'invited' });
    const alert = jest.spyOn(Alert, 'alert');
    renderForm(undefined);

    fireEvent.press(screen.getByText('Email invite'));
    fireEvent.changeText(screen.getByTestId('trainer-client-email'), '  Sam@Example.com ');
    fireEvent.changeText(screen.getByTestId('trainer-client-name'), 'Sam');
    fireEvent.changeText(screen.getByTestId('trainer-client-height'), '180');
    fireEvent.changeText(screen.getByTestId('trainer-client-weight'), '82.5');
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(mockAddTrainerClient).toHaveBeenCalledWith('token-123', {
      email: 'sam@example.com',
      displayName: 'Sam',
      heightValue: 180,
      heightUnit: 'cm',
      weightValue: 82.5,
      weightUnit: 'kg',
    });
    expect(alert).toHaveBeenCalledWith('Invite sent', expect.stringContaining('open Progresso'));
    expect(mockReplace).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('saves nothing when the form is not valid, and says what is missing', () => {
    renderForm(undefined);
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    expect(mockAddTrainerClient).not.toHaveBeenCalled();
    expect(screen.getByText('Usernames are 3–20 letters, numbers or underscores')).toBeTruthy();
  });

  it("edits a managed client's details, loading what is already saved", async () => {
    mockListTrainerClients.mockResolvedValue([
      {
        clientId: 'client-1',
        inviteId: null,
        email: null,
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
