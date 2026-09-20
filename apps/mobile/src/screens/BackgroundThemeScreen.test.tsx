import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { BackgroundThemeProvider } from '../design/BackgroundThemeContext';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { BackgroundThemeScreen } from './BackgroundThemeScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const route = {} as never;

function renderScreen() {
  return render(
    <BackgroundThemeProvider>
      <BackgroundThemeScreen navigation={navigation} route={route} />
    </BackgroundThemeProvider>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockGetMyProfile.mockReset().mockResolvedValue({
    workoutAccentColor: '#2F80FF',
    backgroundTheme: 'obsidian',
    weightUnit: 'kg',
    activeWorkoutSplitId: null,
  });
  mockUpdateMyProfile.mockReset().mockResolvedValue({});
  mockGoBack.mockClear();
});

describe('BackgroundThemeScreen', () => {
  it('renders all nine dark themes with Obsidian selected by default', async () => {
    renderScreen();

    expect(await screen.findByTestId('background-theme-tile-obsidian')).toBeTruthy();
    for (const id of [
      'obsidian',
      'midnight',
      'forest',
      'plum',
      'starlight',
      'aurora',
      'topographic',
      'carbon',
      'particles',
    ]) {
      expect(screen.getByTestId(`background-theme-tile-${id}`)).toBeTruthy();
    }
    expect(
      screen.getByTestId('background-theme-tile-obsidian').props.accessibilityState.selected,
    ).toBe(true);
  });

  it('selecting a different tile updates the selected state and enables Save', async () => {
    renderScreen();
    await screen.findByTestId('background-theme-tile-midnight');

    expect(screen.getByTestId('background-theme-save').props.accessibilityState?.disabled).toBe(
      true,
    );

    fireEvent.press(screen.getByTestId('background-theme-tile-midnight'));

    expect(
      screen.getByTestId('background-theme-tile-midnight').props.accessibilityState.selected,
    ).toBe(true);
    expect(
      screen.getByTestId('background-theme-tile-obsidian').props.accessibilityState.selected,
    ).toBe(false);
    expect(screen.getByTestId('background-theme-save').props.accessibilityState?.disabled).toBe(
      false,
    );
  });

  it('Save persists the selection and navigates back', async () => {
    renderScreen();
    await screen.findByTestId('background-theme-tile-forest');

    fireEvent.press(screen.getByTestId('background-theme-tile-forest'));
    fireEvent.press(screen.getByTestId('background-theme-save'));

    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', { backgroundTheme: 'forest' }),
    );
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('shows a save error and does not navigate back on failure', async () => {
    mockUpdateMyProfile.mockRejectedValue(new Error('Network down'));
    renderScreen();
    await screen.findByTestId('background-theme-tile-plum');

    fireEvent.press(screen.getByTestId('background-theme-tile-plum'));
    fireEvent.press(screen.getByTestId('background-theme-save'));

    expect(await screen.findByTestId('background-theme-save-error')).toHaveTextContent(
      'Network down',
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('goes back without saving when the back button is pressed', async () => {
    renderScreen();
    await screen.findByTestId('background-theme-back');

    fireEvent.press(screen.getByTestId('background-theme-back'));

    expect(mockGoBack).toHaveBeenCalled();
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });
});
