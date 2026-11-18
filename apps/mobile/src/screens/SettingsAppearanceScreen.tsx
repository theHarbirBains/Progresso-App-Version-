import { AppHeader } from '../design/AppHeader';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import { Toggle } from '../design/Toggle';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles } from '../settings/settingsStyles';
import { useAppTheme } from '../theme/appThemeContext';
import { ThemeChoices } from '../theme/ThemeChoices';

type Props = RootStackScreenProps<'SettingsAppearance'>;

/**
 * Settings > Appearance: how Progresso looks on this phone. Nine themes, each a plain background
 * colour with a quiet design over its top, a heading face and one accent -- Golden Hour Gym, the
 * plain classic, first -- as tiles in a grid that preview themselves (theme/ThemeChoices), with one
 * line on what a theme changes; and Change with the seasons, off unless the
 * person turns it on, which shows Spring, Summer, Autumn or Winter by the date where they live. Picking a theme turns the seasons off,
 * so a pick always shows. Through the holidays, Snowfall too -- light snow over the app -- and
 * Holiday Decorations, each on unless turned off. Applied at once, and kept on the phone.
 */
export function SettingsAppearanceScreen({ navigation }: Props) {
  const {
    theme,
    accent,
    followSeasons,
    choose,
    setFollowSeasons,
    snowSeason,
    snowfall,
    setSnowfall,
    decorations,
    setDecorations,
  } = useAppTheme();

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
        <Text testID="appearance-themes-note" style={settingsStyles.intro}>
          Each theme has its own background, design and heading font. Your widgets use its photo.
        </Text>
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

      {/* Only through the holidays (theme/snowSeason.ts): the rest of the year there's no snow. */}
      {snowSeason ? (
        <Section title="Holidays">
          <ListRow
            testID="appearance-snowfall-row"
            icon="cloud-snow"
            title="Snowfall"
            subtitle="Light snow drifting over the app, until early January."
            trailing={
              <Toggle
                testID="appearance-snowfall"
                value={snowfall}
                onValueChange={setSnowfall}
                accentColor={accent.accent}
                onAccentColor={accent.onAccent}
                accessibilityLabel="Snowfall"
              />
            }
          />
          <ListRow
            testID="appearance-decorations-row"
            icon="gift"
            title="Holiday Decorations"
            subtitle="A Santa hat on each page's title, and lights along the tab bar."
            trailing={
              <Toggle
                testID="appearance-decorations"
                value={decorations}
                onValueChange={setDecorations}
                accentColor={accent.accent}
                onAccentColor={accent.onAccent}
                accessibilityLabel="Holiday Decorations"
              />
            }
          />
        </Section>
      ) : null}
    </Screen>
  );
}
