import { Feather } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { Badge } from '../design/Badge';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
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
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(screen.getByTestId('choose-split-preset-ppl')).toBeTruthy();
    expect(screen.getByTestId('choose-split-preset-upper-lower')).toBeTruthy();
    expect(screen.getByTestId('choose-split-preset-full-body')).toBeTruthy();
    expect(screen.getByTestId('choose-split-preset-bro-split')).toBeTruthy();
    expect(screen.getByTestId('choose-split-preset-ppl-upper-lower')).toBeTruthy();
  });

  it('shows a concise line of day names per preset instead of the full structured muscle-group list', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    const pplCard = screen.getByTestId('choose-split-preset-ppl');
    // One quiet line ("Push · Pull · Legs"), not a badge per day.
    expect(within(pplCard).getByText('Push · Pull · Legs')).toBeTruthy();
    // The full structured muscle-group breakdown is no longer printed on the
    // card -- scoped to this card specifically, since "Shoulders" is itself
    // a legitimate day name on the Bro Split preset elsewhere on screen.
    expect(within(pplCard).queryByText(/Shoulders/)).toBeNull();
    expect(within(pplCard).queryByText(/Triceps/)).toBeNull();
  });

  it('shows a short description for each preset', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

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
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

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
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

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

    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    fireEvent.press(screen.getByTestId('choose-split-preset-ppl'));

    expect(await screen.findByTestId('choose-split-preset-ppl-selected')).toBeTruthy();

    resolveMaterialize({ id: 'split-new', name: 'Push / Pull / Legs' });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('navigates to WorkoutSplitForm with activateOnCreate when Create Your Own is pressed', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    fireEvent.press(screen.getByTestId('choose-split-create-own'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplitForm', { activateOnCreate: true });
  });

  it('shows an error message without crashing when materializing fails', async () => {
    mockMaterializeWorkoutSplitPreset.mockRejectedValue(new Error('network error'));

    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    fireEvent.press(screen.getByTestId('choose-split-preset-ppl'));

    expect(await screen.findByTestId('choose-split-error')).toHaveTextContent('network error');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('goes back when Back is pressed', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    fireEvent.press(screen.getByTestId('choose-split-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('navigates to WorkoutSplits when the settings icon is pressed', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

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

    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

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

    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('choose-split-preset-ppl');

    expect(screen.queryByTestId('choose-split-preset-ppl-selected')).toBeNull();
  });
});

describe('ChooseWorkoutSplitScreen -- plain rows, one secondary action', () => {
  it('shows every preset as a row of name, description and day names -- no cards, badges or icon circles', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(0);
    expect(screen.UNSAFE_queryAllByType(Badge)).toHaveLength(0);
    const row = screen.getByTestId('choose-split-preset-ppl');
    expect(row.props.accessibilityRole).toBe('button');
    expect(
      within(row).getByText('A balanced and popular split for strength and muscle growth.'),
    ).toBeTruthy();
    expect(within(row).getByText('Push · Pull · Legs')).toBeTruthy();
  });

  it('separates the preset rows with hairlines, none above the first', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    const first = StyleSheet.flatten(screen.getByTestId('choose-split-preset-ppl').props.style);
    const second = StyleSheet.flatten(
      screen.getByTestId('choose-split-preset-upper-lower').props.style,
    );
    expect(first.borderTopWidth).toBeUndefined();
    expect(second.borderTopWidth).toBe(StyleSheet.hairlineWidth);
  });

  it('marks the selected preset only with a check in the mode accent, and disables the others while it loads', async () => {
    let finish: () => void = () => undefined;
    mockMaterializeWorkoutSplitPreset.mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ id: 'new-split', name: 'PPL' });
      }),
    );
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    fireEvent.press(screen.getByTestId('choose-split-preset-ppl'));

    const check = await screen.findByTestId('choose-split-preset-ppl-selected');
    const icon = screen
      .UNSAFE_getAllByType(Feather)
      .find((node) => node.props.testID === check.props.testID);
    expect(icon?.props.color).toBe(DEFAULT_WORKOUT_THEME.accent);
    expect(
      screen.getByTestId('choose-split-preset-upper-lower').props.accessibilityState.disabled,
    ).toBe(true);
    finish();
  });

  it('offers "Create Custom Split" as the one secondary action, not a competing filled button', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    const create = screen.getByTestId('choose-split-create-own');
    const style = StyleSheet.flatten(create.props.style);
    expect(create.props.accessibilityRole).toBe('button');
    expect(style.backgroundColor).toBeUndefined();
    expect(style.borderWidth).toBe(1);
    expect(create).toHaveTextContent('Create Custom Split');
  });

  it('puts Back and Manage-splits in the shared header, each named for assistive tech', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(screen.getByTestId('choose-split-back').props.accessibilityLabel).toBe('Back');
    expect(screen.getByTestId('choose-split-settings').props.accessibilityLabel).toBe(
      'Manage workout splits',
    );
    expect(screen.getByText('Pick a split that matches your goals and schedule.')).toBeTruthy();
  });

  it('gives every preset row at least a 44pt target', () => {
    render(<ChooseWorkoutSplitScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(
      StyleSheet.flatten(screen.getByTestId('choose-split-preset-ppl').props.style).minHeight,
    ).toBeGreaterThanOrEqual(44);
  });
});
