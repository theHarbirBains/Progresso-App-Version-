import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useProfile } from '../profile/ProfileProvider';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAppTheme } from '../theme/appThemeContext';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { SettingsAppearanceScreen } from './SettingsAppearanceScreen';

jest.mock('../profile/ProfileProvider', () => ({ useProfile: jest.fn() }));

const mockUseProfile = useProfile as jest.Mock;
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: jest.fn() };

// What the rest of the app sees: the theme showing.
function ShownTheme() {
  const { theme } = useAppTheme();
  return <Text testID="shown-theme">{theme.id}</Text>;
}

async function renderScreen() {
  render(
    <AppThemeProvider>
      <SettingsAppearanceScreen navigation={navigation} route={{} as never} />
      <ShownTheme />
    </AppThemeProvider>,
  );
  await screen.findByTestId('appearance-theme-golden-hour-gym');
  await act(async () => {});
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockUseProfile.mockReturnValue({ profile: { country: 'CA' } });
});

describe('SettingsAppearanceScreen', () => {
  it('offers the eight themes, Golden Hour Gym first and chosen to start', async () => {
    await renderScreen();

    const tiles = screen.getAllByTestId(/^appearance-theme-/);
    expect(tiles).toHaveLength(8);
    expect(tiles[0]).toHaveTextContent(/Golden Hour Gym/);
    expect(screen.getByTestId('appearance-theme-golden-hour-gym').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('shown-theme')).toHaveTextContent('golden-hour-gym');
  });

  it('changes the whole app’s look at once when a theme is picked', async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId('appearance-theme-winter'));

    expect(screen.getByTestId('shown-theme')).toHaveTextContent('winter');
    expect(screen.getByTestId('appearance-theme-winter').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('@progresso/appearance')).toContain('winter'),
    );
  });

  it('follows the seasons only when switched on, and says which it is showing', async () => {
    await renderScreen();
    expect(screen.getByTestId('appearance-seasons').props.value).toBe(false);

    fireEvent(screen.getByTestId('appearance-seasons'), 'valueChange', true);

    expect(screen.getByTestId('appearance-seasons-row')).toHaveTextContent(
      /Showing \w+ for the season/,
    );
    expect(['spring', 'summer', 'autumn', 'winter']).toContain(
      screen.getByTestId('shown-theme').props.children,
    );
  });

  it('credits the photographers', async () => {
    await renderScreen();

    expect(screen.getByTestId('appearance-credits')).toHaveTextContent(/Unsplash/);
    expect(screen.getByTestId('appearance-credits')).toHaveTextContent(/Sergei A \(Forest\)/);
  });

  it('goes back from its header, and renders no bare text', async () => {
    await renderScreen();

    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockGoBack).toHaveBeenCalled();
    expectNoBareText();
  });
});
