import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { fetchWorkoutSplits, materializeWorkoutSplitPreset } from '../workouts/workoutSplitQueries';
import { ChooseWorkoutSplitScreen } from './ChooseWorkoutSplitScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn().mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    activeWorkoutSplitId: null,
  }),
  updateMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  materializeWorkoutSplitPreset: jest.fn(),
  fetchWorkoutSplits: jest.fn().mockResolvedValue([]),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockMaterializeWorkoutSplitPreset = materializeWorkoutSplitPreset as jest.Mock;
const mockFetchWorkoutSplits = fetchWorkoutSplits as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: mockNavigate };
const route = {} as never;

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockMaterializeWorkoutSplitPreset
    .mockReset()
    .mockResolvedValue({ id: 'split-new', name: 'Push / Pull / Legs' });
  mockGetMyProfile.mockReset().mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    activeWorkoutSplitId: null,
  });
  mockUpdateMyProfile.mockReset().mockResolvedValue(undefined);
  mockFetchWorkoutSplits.mockReset().mockResolvedValue([]);
  mockGoBack.mockClear();
  mockNavigate.mockClear();
});

describe('ChooseWorkoutSplitScreen', () => {
  it('lists every preset', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);

    expect(screen.getByTestId('choose-split-preset-ppl')).toBeTruthy();
    expect(screen.getByTestId('choose-split-preset-upper-lower')).toBeTruthy();
    expect(screen.getByTestId('choose-split-preset-full-body')).toBeTruthy();
    expect(screen.getByTestId('choose-split-preset-bro-split')).toBeTruthy();
    expect(screen.getByTestId('choose-split-preset-ppl-upper-lower')).toBeTruthy();
  });

  it('shows a concise day-name chip per day instead of the full structured muscle-group list', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);

    const pplCard = screen.getByTestId('choose-split-preset-ppl');
    expect(within(pplCard).getByText('Push')).toBeTruthy();
    expect(within(pplCard).getByText('Pull')).toBeTruthy();
    expect(within(pplCard).getByText('Legs')).toBeTruthy();
    // The full structured muscle-group breakdown is no longer printed on the
    // card -- scoped to this card specifically, since "Shoulders" is itself
    // a legitimate day name on the Bro Split preset elsewhere on screen.
    expect(within(pplCard).queryByText(/Shoulders/)).toBeNull();
    expect(within(pplCard).queryByText(/Triceps/)).toBeNull();
  });

  it('shows a short description for each preset', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);

    expect(
      screen.getByText('A balanced and popular split for strength and muscle growth.'),
    ).toBeTruthy();
    expect(
      screen.getByText('A simple, effective split great for strength and flexibility.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Train everything in each session. Great for beginners or busy schedules.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Focus on one muscle group per day. Classic and straightforward.'),
    ).toBeTruthy();
    expect(
      screen.getByText('The most complete split for maximum variety and progression.'),
    ).toBeTruthy();
  });

  it('does not include Hypertrophy/Strength/Cutting/Bulking in any preset name', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);

    // Scoped to the preset *name* text specifically -- descriptions are
    // free-form copy and may legitimately use a plain word like "strength"
    // in a sentence without that being the "PPL - Strength" style naming
    // this check actually guards against.
    for (const id of ['ppl', 'upper-lower', 'full-body', 'bro-split', 'ppl-upper-lower']) {
      const name = screen.getByTestId(`choose-split-preset-${id}-name`).props.children;
      expect(name).not.toMatch(/Hypertrophy/i);
      expect(name).not.toMatch(/Strength/i);
      expect(name).not.toMatch(/Cutting/i);
      expect(name).not.toMatch(/Bulking/i);
    }
  });

  it('materializes and activates the selected preset, then goes back', async () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByTestId('choose-split-preset-ppl'));

    await waitFor(() =>
      expect(mockMaterializeWorkoutSplitPreset).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ id: 'ppl' }),
      ),
    );
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      activeWorkoutSplitId: 'split-new',
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows the selected preset as immediately obvious (checkmark) while it materializes', async () => {
    let resolveMaterialize: (value: { id: string; name: string }) => void = () => {};
    mockMaterializeWorkoutSplitPreset.mockReturnValue(
      new Promise((resolve) => {
        resolveMaterialize = resolve;
      }),
    );

    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);
    fireEvent.press(screen.getByTestId('choose-split-preset-ppl'));

    expect(await screen.findByTestId('choose-split-preset-ppl-selected')).toBeTruthy();

    resolveMaterialize({ id: 'split-new', name: 'Push / Pull / Legs' });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('navigates to WorkoutSplitForm with activateOnCreate when Create Your Own is pressed', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByTestId('choose-split-create-own'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitForm', { activateOnCreate: true });
  });

  it('shows an error message without crashing when materializing fails', async () => {
    mockMaterializeWorkoutSplitPreset.mockRejectedValue(new Error('network error'));

    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);
    fireEvent.press(screen.getByTestId('choose-split-preset-ppl'));

    expect(await screen.findByTestId('choose-split-error')).toHaveTextContent('network error');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('goes back when Back is pressed', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByTestId('choose-split-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('navigates to WorkoutSplits when the settings icon is pressed', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByTestId('choose-split-settings'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplits');
  });

  it("shows the preset matching the user's current active split as already selected", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'kg',
      workoutAccentColor: null,
      nutritionAccentColor: null,
      activeWorkoutSplitId: 'split-1',
    });
    mockFetchWorkoutSplits.mockResolvedValue([
      { id: 'split-1', name: 'Push / Pull / Legs' },
      { id: 'split-2', name: 'Some Other Split' },
    ]);

    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('choose-split-preset-ppl-selected')).toBeTruthy();
    expect(screen.queryByTestId('choose-split-preset-upper-lower-selected')).toBeNull();
  });

  it('shows no preset as selected when the active split matches no preset name (custom split)', async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'kg',
      workoutAccentColor: null,
      nutritionAccentColor: null,
      activeWorkoutSplitId: 'split-1',
    });
    mockFetchWorkoutSplits.mockResolvedValue([{ id: 'split-1', name: 'My Custom Split' }]);

    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />);
    await screen.findByTestId('choose-split-preset-ppl');

    expect(screen.queryByTestId('choose-split-preset-ppl-selected')).toBeNull();
  });
});
