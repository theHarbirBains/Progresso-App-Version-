import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Image, StyleSheet, Text } from 'react-native';
import { useProfile } from '../profile/ProfileProvider';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAppTheme } from '../theme/appThemeContext';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { SettingsAppearanceScreen } from './SettingsAppearanceScreen';

jest.mock('../profile/ProfileProvider', () => ({ useProfile: jest.fn() }));
// The holidays, unless a test says otherwise (the real date would make these tests seasonal).
const mockIsSnowSeason = jest.fn(() => true);
jest.mock('../theme/snowSeason', () => ({ isSnowSeason: () => mockIsSnowSeason() }));

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
  mockIsSnowSeason.mockReturnValue(true);
  await AsyncStorage.clear();
  mockUseProfile.mockReturnValue({ profile: { country: 'CA' } });
});

describe('SettingsAppearanceScreen', () => {
  it('offers the nine themes, Golden Hour Gym first, Holiday Gym last and chosen to start', async () => {
    await renderScreen();

    const tiles = screen.getAllByTestId(/^appearance-theme-/);
    expect(tiles).toHaveLength(9);
    expect(tiles[0]).toHaveTextContent(/Golden Hour Gym/);
    expect(tiles[8]).toHaveTextContent(/Holiday Gym/);
    expect(screen.getByTestId('appearance-theme-holiday-gym').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('shown-theme')).toHaveTextContent('holiday-gym');
  });

  it('previews each theme in its own background, design, heading face and accent -- never a photo', async () => {
    await renderScreen();

    expect(screen.getByTestId('appearance-themes-note')).toHaveTextContent(
      /^Each theme has its own background, design and heading font\. Your widgets and share card use its photo\.$/,
    );
    const forest = screen.getByTestId('appearance-theme-forest');
    expect(forest.props.accessibilityLabel).toBe('Forest theme, Fraunces headings');
    expect(
      StyleSheet.flatten(screen.getByTestId('theme-sample-forest').props.style).fontFamily,
    ).toBe('Fraunces_800ExtraBold');
    expect(
      StyleSheet.flatten(screen.getByTestId('theme-sample-alpine').props.style).fontFamily,
    ).toBe('Oswald_700Bold');
    expect(screen.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it('can wear Holiday Gym, its accent the gold of the lights', async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId('appearance-theme-holiday-gym'));

    await waitFor(() => expect(screen.getByTestId('shown-theme')).toHaveTextContent('holiday-gym'));
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

  it('credits no one else: every photo is Progresso’s own', async () => {
    await renderScreen();

    expect(screen.queryByTestId('appearance-credits')).toBeNull();
    expect(screen.queryByText(/Unsplash/)).toBeNull();
  });

  it('goes back from its header, and renders no bare text', async () => {
    await renderScreen();

    fireEvent.press(screen.getByLabelText('Back'));
    expect(mockGoBack).toHaveBeenCalled();
    expectNoBareText();
  });

  it('turns the holiday snow off and on, through the holidays', async () => {
    await renderScreen();

    const snowfall = screen.getByTestId('appearance-snowfall');
    expect(snowfall.props.value).toBe(true);
    expect(screen.getByTestId('appearance-snowfall-row')).toHaveTextContent(/until early January/);

    fireEvent(snowfall, 'valueChange', false);

    expect(screen.getByTestId('appearance-snowfall').props.value).toBe(false);
  });

  it('turns the holiday decorations off and on, apart from the snow', async () => {
    await renderScreen();

    const decorations = screen.getByTestId('appearance-decorations');
    expect(decorations.props.value).toBe(true);
    expect(screen.getByTestId('appearance-decorations-row')).toHaveTextContent(
      /Holiday Decorations.*Santa hat/,
    );

    fireEvent(decorations, 'valueChange', false);

    expect(screen.getByTestId('appearance-decorations').props.value).toBe(false);
    expect(screen.getByTestId('appearance-snowfall').props.value).toBe(true);
  });

  it('has no Snowfall or Decorations switch the rest of the year', async () => {
    mockIsSnowSeason.mockReturnValue(false);
    await renderScreen();

    expect(screen.queryByTestId('appearance-snowfall-row')).toBeNull();
    expect(screen.queryByTestId('appearance-decorations-row')).toBeNull();
  });
});
