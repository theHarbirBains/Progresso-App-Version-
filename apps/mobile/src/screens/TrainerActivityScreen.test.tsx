import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { listTrainerClients } from '../lib/api';
import { forgetShown } from '../lib/lastShown';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { fetchClientsActivity } from '../trainer/clientQueries';
import { WorkspaceContext } from '../workspace/WorkspaceContext';
import { TrainerActivityScreen } from './TrainerActivityScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  listTrainerClients: jest.fn(),
}));

jest.mock('../trainer/clientQueries', () => ({
  fetchClientsActivity: jest.fn(),
}));

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({
    theme: { accent: '#3DDC97', onAccent: '#000000' },
    weightUnit: 'kg',
    displayName: 'Coach Jo',
    avatarUrl: null,
  }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockListTrainerClients = listTrainerClients as jest.Mock;
const mockFetchClientsActivity = fetchClientsActivity as jest.Mock;

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  // The page loads on focus -- which, as in the app, comes once as it opens.
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};

const client = {
  clientId: 'client-1',
  status: 'active',
  source: 'managed',
  displayName: 'Sam',
  birthday: null,
  heightValue: 180,
  heightUnit: 'cm',
  weightValue: 80,
  weightUnit: 'kg',
};

const workout = {
  id: 'w1',
  name: 'Push Day',
  performedAt: '2026-10-16T12:00:00Z',
  completedAt: '2026-10-16T13:00:00Z',
  workoutSplitDayId: null,
  splitDayName: null,
  muscleGroups: [],
  completedSetCount: 12,
  totalVolumeKg: 1000,
  durationMinutes: 60,
  exerciseCount: 4,
  completedExerciseCount: 4,
  topSets: [{ exerciseId: 'bench', exerciseName: 'Bench Press', weightKg: 100, reps: 8 }],
};

function renderScreen() {
  return render(<TrainerActivityScreen navigation={navigation} route={{} as never} />);
}

beforeEach(() => {
  forgetShown();
  mockUseAuth.mockReturnValue({
    session: { access_token: 'token-123' },
    user: { id: 'trainer-1' },
  });
  mockListTrainerClients.mockReset();
  mockFetchClientsActivity.mockReset();
  mockNavigate.mockClear();
});

describe('TrainerActivityScreen', () => {
  it("shows each client's latest workouts, with their name, and opens the client", async () => {
    mockListTrainerClients.mockResolvedValue([client]);
    mockFetchClientsActivity.mockResolvedValue([
      { clientId: 'client-1', clientName: 'Sam', workout },
    ]);
    renderScreen();

    const card = await screen.findByTestId('trainer-activity-workout-w1');
    expect(card).toHaveTextContent(/Sam/);
    expect(card).toHaveTextContent(/Push Day/);

    fireEvent.press(card);
    expect(mockNavigate).toHaveBeenCalledWith('TrainerClientDetail', {
      clientId: 'client-1',
      clientName: 'Sam',
    });
  });

  it('only reads active clients -- not an invite, or a request still waiting', async () => {
    mockListTrainerClients.mockResolvedValue([
      client,
      { ...client, clientId: 'client-2', displayName: 'Ana', status: 'pending', source: 'linked' },
      { ...client, clientId: null, inviteId: 'invite-1', displayName: 'Lee', status: 'pending' },
    ]);
    mockFetchClientsActivity.mockResolvedValue([]);
    renderScreen();

    await screen.findByTestId('trainer-activity-empty');
    expect(mockFetchClientsActivity).toHaveBeenCalledWith([{ clientId: 'client-1', name: 'Sam' }]);
  });

  it('reopens showing what it showed last time, while it refreshes', async () => {
    mockListTrainerClients.mockResolvedValue([client]);
    mockFetchClientsActivity.mockResolvedValue([
      { clientId: 'client-1', clientName: 'Sam', workout },
    ]);
    const first = renderScreen();
    await screen.findByTestId('trainer-activity-workout-w1');
    first.unmount();

    mockListTrainerClients.mockReturnValue(new Promise(() => undefined));
    renderScreen();

    expect(screen.getByTestId('trainer-activity-workout-w1')).toBeTruthy();
    expect(screen.queryByTestId('trainer-activity-loading')).toBeNull();
  });

  it('says so when no client has finished a workout yet', async () => {
    mockListTrainerClients.mockResolvedValue([client]);
    mockFetchClientsActivity.mockResolvedValue([]);
    renderScreen();

    expect(await screen.findByTestId('trainer-activity-empty')).toHaveTextContent(
      /No client workouts yet/,
    );
  });

  it('shows an error with a retry when the clients cannot be loaded', async () => {
    mockListTrainerClients.mockRejectedValueOnce(new Error('Network down'));
    renderScreen();

    expect(await screen.findByTestId('trainer-activity-error')).toHaveTextContent(/Network down/);

    mockListTrainerClients.mockResolvedValue([client]);
    mockFetchClientsActivity.mockResolvedValue([]);
    fireEvent.press(screen.getByTestId('trainer-activity-error-retry'));
    expect(await screen.findByTestId('trainer-activity-empty')).toBeTruthy();
  });

  it('has the menu button and the workspace switcher, as a Trainer Workspace tab', async () => {
    mockListTrainerClients.mockResolvedValue([]);
    mockFetchClientsActivity.mockResolvedValue([]);
    const openMenu = jest.fn();
    render(
      <AppMenuContext.Provider value={{ openMenu, currentMode: 'workout' }}>
        <WorkspaceContext.Provider
          value={{ workspace: 'trainer', isTrainer: true, switchTo: jest.fn() }}
        >
          <TrainerActivityScreen navigation={navigation} route={{} as never} />
        </WorkspaceContext.Provider>
      </AppMenuContext.Provider>,
    );

    await screen.findByTestId('trainer-activity-empty');
    expect(screen.getByTestId('workspace-switcher')).toBeTruthy();
    fireEvent.press(screen.getByTestId('trainer-activity-open-menu'));
    expect(openMenu).toHaveBeenCalled();
  });
});
