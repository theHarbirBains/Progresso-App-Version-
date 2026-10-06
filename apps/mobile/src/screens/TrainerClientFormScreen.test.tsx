import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  addTrainerClient,
  listTrainerClients,
  trackTrainerClient,
  updateTrainerClientProfile,
} from '../lib/api';
import {
  heightCmFromValues,
  TrainerClientFormScreen,
  validateClientForm,
  validateHeight,
  type ClientFormValues,
} from './TrainerClientFormScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  addTrainerClient: jest.fn(),
  listTrainerClients: jest.fn(),
  updateTrainerClientProfile: jest.fn(),
  trackTrainerClient: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockAddTrainerClient = addTrainerClient as jest.Mock;
const mockListTrainerClients = listTrainerClients as jest.Mock;
const mockUpdate = updateTrainerClientProfile as jest.Mock;
const mockTrack = trackTrainerClient as jest.Mock;

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
  heightUnit: 'cm',
  heightText: '',
  feetText: '',
  inchesText: '',
  weightText: '',
  weightUnit: 'kg',
};

describe('height in either unit', () => {
  it('accepts feet and inches, and converts them to cm for storage', () => {
    expect(
      validateHeight({ heightUnit: 'ft_in', heightText: '', feetText: '5', inchesText: '11' }),
    ).toBeUndefined();
    expect(
      heightCmFromValues({ ...blank, heightUnit: 'ft_in', feetText: '5', inchesText: '11' }),
    ).toBe(180);
  });

  it('refuses inches past eleven, and feet outside a plausible range', () => {
    expect(
      validateHeight({ heightUnit: 'ft_in', heightText: '', feetText: '5', inchesText: '12' }),
    ).toBeDefined();
    expect(
      validateHeight({ heightUnit: 'ft_in', heightText: '', feetText: '2', inchesText: '0' }),
    ).toBeDefined();
  });

  it('treats an unentered height as not given in either unit', () => {
    expect(heightCmFromValues({ ...blank, heightUnit: 'cm', heightText: '' })).toBeUndefined();
    expect(
      heightCmFromValues({ ...blank, heightUnit: 'ft_in', feetText: '', inchesText: '' }),
    ).toBeUndefined();
  });

  it('sends the converted cm with the unit the trainer chose', async () => {
    mockTrack.mockResolvedValue({
      clientId: 'c1',
      claimCode: 'ABCD-2345',
      expiresAt: '2026-11-01T00:00:00.000Z',
    });
    renderForm(undefined);

    fireEvent.press(screen.getByText('ft / in'));
    fireEvent.changeText(screen.getByTestId('trainer-client-name'), 'Pat');
    fireEvent.changeText(screen.getByTestId('trainer-client-height-feet'), '5');
    fireEvent.changeText(screen.getByTestId('trainer-client-height-inches'), '11');
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    await waitFor(() => expect(mockTrack).toHaveBeenCalled());
    expect(mockTrack).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ heightValue: 180, heightUnit: 'ft_in' }),
    );
  });
});

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
  mockTrack.mockReset();
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

    fireEvent.press(screen.getByText('Username'));
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

    fireEvent.press(screen.getByText('Username'));
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

  it('tracks a client with no account, and opens the code to give them', async () => {
    mockTrack.mockResolvedValue({
      clientId: 'client-9',
      claimCode: 'ABCD-2345',
      expiresAt: '2026-11-01T00:00:00.000Z',
    });
    renderForm(undefined);

    fireEvent.press(screen.getByText('No account'));
    fireEvent.changeText(screen.getByTestId('trainer-client-name'), 'Pat');
    fireEvent.changeText(screen.getByTestId('trainer-client-height'), '170');
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('TrainerClaimCode', {
        code: 'ABCD-2345',
        clientId: 'client-9',
        clientName: 'Pat',
      }),
    );
    expect(mockTrack).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ displayName: 'Pat', heightValue: 170, heightUnit: 'cm' }),
    );
    expect(mockAddTrainerClient).not.toHaveBeenCalled();
  });

  it('needs a name before tracking someone without an account', () => {
    renderForm(undefined);

    fireEvent.press(screen.getByText('No account'));
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    expect(mockTrack).not.toHaveBeenCalled();
    expect(screen.getByText('Enter their name')).toBeTruthy();
  });

  it('saves nothing when the form is not valid, and says what is missing', () => {
    renderForm(undefined);
    fireEvent.press(screen.getByTestId('trainer-client-save'));

    expect(mockAddTrainerClient).not.toHaveBeenCalled();
    expect(screen.getByText('Enter their name')).toBeTruthy();
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
