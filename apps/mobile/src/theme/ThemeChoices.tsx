import { StyleSheet, View } from 'react-native';
import { BackgroundPattern } from '../design/BackgroundPattern';
import { ChoiceTile } from '../design/ChoiceTile';
import { HEADING_FONTS } from '../design/headingFont';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { buildAccentTheme } from './accentColor';
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
  // Each tile is a small screen of its theme: its background and design, a heading in its face,
  // and its accent -- and, chosen, its own accent's edge and check, so a choice previews itself.
  const accent = buildAccentTheme(theme.accent);
  const font = HEADING_FONTS[theme.font];
  return (
    <ChoiceTile
      testID={testID}
      selected={selected}
      onPress={onPress}
      accentColor={accent.accent}
      onAccentColor={accent.onAccent}
      accessibilityLabel={`${theme.name} theme, ${font.name} headings`}
      style={styles.tile}
    >
      <View style={[styles.preview, { backgroundColor: theme.background }]}>
        <BackgroundPattern
          pattern={theme.pattern}
          color={accent.accent}
          background={theme.background}
          fade={false}
        />
        {/* The theme's heading face, named in its own family so the current theme's never applies. */}
        <Text
          testID={`theme-sample-${theme.id}`}
          style={[styles.sample, { fontFamily: font.displayHeavy }]}
        >
          Aa
        </Text>
        <View style={[styles.bar, { backgroundColor: accent.accent }]} />
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
 * The themes as a two-column grid of tiles -- each its background and design, "Aa" in its heading
 * face, a bar and a dot of its accent and its name -- for Settings > Appearance. A tile is
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
    padding: spacing.sm,
  },
  sample: {
    ...typeScale.display,
    color: colors.textPrimary,
  },
  // A swatch of the accent, the way a button would wear it.
  bar: {
    height: 6,
    width: '45%',
    borderRadius: radii.pill,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
