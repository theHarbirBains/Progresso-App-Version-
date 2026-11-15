import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChoiceTile } from '../design/ChoiceTile';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { buildAccentTheme, withAlpha } from './accentColor';
import { APP_THEMES, type AppTheme, type AppThemeId } from './appThemes';

function ThemeTile({
  theme,
  selected,
  onPress,
  testID,
}: {
  theme: AppTheme;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  // Each tile shows its own accent when chosen, so the choice previews itself.
  const accent = buildAccentTheme(theme.accent);
  return (
    <ChoiceTile
      testID={testID}
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
 * The eight themes as a two-column grid of tiles -- each the top of its photo with a fade, a dot
 * of its accent and its name -- for Settings > Appearance and onboarding alike. A tile is
 * `${testIDPrefix}-${theme id}`.
 */
export function ThemeChoices({
  selectedId,
  onChoose,
  testIDPrefix,
}: {
  selectedId: AppThemeId;
  onChoose: (id: AppThemeId) => void;
  testIDPrefix: string;
}) {
  const rows: AppTheme[][] = [];
  for (let i = 0; i < APP_THEMES.length; i += 2) rows.push(APP_THEMES.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0].id} style={styles.row}>
          {row.map((item) => (
            <ThemeTile
              key={item.id}
              theme={item}
              selected={item.id === selectedId}
              onPress={() => onChoose(item.id)}
              testID={`${testIDPrefix}-${item.id}`}
            />
          ))}
          {/* A last row of one keeps its tile the size of the rest. */}
          {row.length === 1 ? <View style={styles.tile} /> : null}
        </View>
      ))}
    </View>
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
});
