import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '../design/AppHeader';
import { ChoiceTile } from '../design/ChoiceTile';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import { Toggle } from '../design/Toggle';
import { colors, radii, spacing, typeScale } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles } from '../settings/settingsStyles';
import { buildAccentTheme, withAlpha } from '../theme/accentColor';
import { useAppTheme } from '../theme/appThemeContext';
import { APP_THEMES, type AppTheme } from '../theme/appThemes';

type Props = RootStackScreenProps<'SettingsAppearance'>;

const PHOTOGRAPHERS = APP_THEMES.filter((theme) => theme.photographer)
  .map((theme) => `${theme.photographer} (${theme.name})`)
  .join(', ');

function ThemeTile({
  theme,
  selected,
  onPress,
}: {
  theme: AppTheme;
  selected: boolean;
  onPress: () => void;
}) {
  // Each tile shows its own accent when chosen, so the choice previews itself.
  const accent = buildAccentTheme(theme.accent);
  return (
    <ChoiceTile
      testID={`appearance-theme-${theme.id}`}
      selected={selected}
      onPress={onPress}
      accentColor={accent.accent}
      onAccentColor={accent.onAccent}
      accessibilityLabel={`${theme.name} theme`}
      style={styles.tile}
    >
      <View style={styles.preview}>
        <Image
          source={theme.photo}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="top"
        />
        <LinearGradient
          colors={[withAlpha(colors.background, 0), withAlpha(colors.background, 0.85)]}
          locations={[0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.caption}>
          <View style={[styles.dot, { backgroundColor: accent.accent }]} />
          <Text style={styles.name} numberOfLines={1}>
            {theme.name}
          </Text>
        </View>
      </View>
    </ChoiceTile>
  );
}

/**
 * Settings > Appearance: how Progresso looks on this phone. Eight themes, each a photo behind the
 * top of every screen and one accent -- Golden Hour Gym, the original look, first -- as tiles in
 * a grid; and Change with the seasons, off unless the person turns it on, which shows Spring,
 * Summer, Autumn or Winter by the date where they live. Picking a theme turns the seasons off,
 * so a pick always shows. Applied at once, and kept on the phone.
 */
export function SettingsAppearanceScreen({ navigation }: Props) {
  const { theme, accent, followSeasons, choose, setFollowSeasons } = useAppTheme();

  const rows: AppTheme[][] = [];
  for (let i = 0; i < APP_THEMES.length; i += 2) rows.push(APP_THEMES.slice(i, i + 2));

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
        <View style={styles.grid}>
          {rows.map((row) => (
            <View key={row[0].id} style={styles.row}>
              {row.map((item) => (
                <ThemeTile
                  key={item.id}
                  theme={item}
                  selected={item.id === theme.id}
                  onPress={() => choose(item.id)}
                />
              ))}
            </View>
          ))}
        </View>
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

      <Text testID="appearance-credits" style={styles.credits}>
        Theme photos from Unsplash by {PHOTOGRAPHERS}.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    padding: 0,
    overflow: 'hidden',
  },
  preview: {
    aspectRatio: 4 / 5,
    borderRadius: radii.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radii.pill,
  },
  name: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  credits: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
});
