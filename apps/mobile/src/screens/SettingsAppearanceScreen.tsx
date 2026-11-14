import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Toggle } from '../design/Toggle';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles } from '../settings/settingsStyles';
import { useAppTheme } from '../theme/appThemeContext';
import { ThemeChoices } from '../theme/ThemeChoices';

type Props = RootStackScreenProps<'SettingsAppearance'>;

/**
 * Settings > Appearance: how Progresso looks on this phone. Eight themes, each a photo behind the
 * top of every screen and one accent -- Golden Hour Gym, the default, first -- as tiles in a grid
 * (theme/ThemeChoices, which onboarding shows too); and Change with the seasons, off unless the
 * person turns it on, which shows Spring, Summer, Autumn or Winter by the date where they live. Picking a theme turns the seasons off,
 * so a pick always shows. Applied at once, and kept on the phone.
 */
export function SettingsAppearanceScreen({ navigation }: Props) {
  const { theme, accent, followSeasons, choose, setFollowSeasons } = useAppTheme();

  return (
    <Screen
      testID="settings-appearance-screen"
      scrollTestID="settings-appearance-scroll"
      contentContainerStyle={settingsStyles.categoryGap}
      header={
        <AppHeader
          testID="settings-appearance-header"
          title="Appearance"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <Section title="Theme">
        <ThemeChoices selectedId={theme.id} onChoose={choose} testIDPrefix="appearance-theme" />
      </Section>

      <Section title="Seasons">
        <ListRow
          testID="appearance-seasons-row"
          icon="sun"
          title="Change with the seasons"
          subtitle={
            followSeasons
              ? `Showing ${theme.name} for the season where you live.`
              : 'Spring, Summer, Autumn or Winter, by the date where you live.'
          }
          trailing={
            <Toggle
              testID="appearance-seasons"
              value={followSeasons}
              onValueChange={setFollowSeasons}
              accentColor={accent.accent}
              onAccentColor={accent.onAccent}
              accessibilityLabel="Change with the seasons"
            />
          }
        />
      </Section>
    </Screen>
  );
}
