import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { wholeFigure } from './wholeFigures';

export type MacroKey = 'protein' | 'carbs' | 'fat';

export interface MacroFigure {
  key: MacroKey;
  label: string;
  /** Grams eaten -- or, on Progress, eaten a day on average. */
  consumed: number;
  /** The daily target in grams; null with none. */
  goal: number | null;
}

// Each macro's glyph -- the same food-category glyph set as a food's picture
// (nutrition/foodGlyph.ts), in its quiet raised tile.
const MACRO_GLYPHS: Record<MacroKey, keyof typeof MaterialCommunityIcons.glyphMap> = {
  protein: 'food-drumstick-outline',
  carbs: 'barley',
  fat: 'water-outline',
};

function grams(value: number): string {
  return `${wholeFigure(value)}g`;
}

interface Props {
  macros: MacroFigure[];
  accentColor: string;
  /** Put before each row's testIDs: "protein-row" becomes "progress-nutrition-protein-row". */
  testIDPrefix?: string;
  /** Read out after each figure: "a day on average". */
  spokenSuffix?: string;
}

/**
 * Protein, carbs and fat as rows: a glyph in a round raised tile, the label, the grams as a mono
 * readout against "/ target" in muted text, and a 4pt bar of the way there in the accent, never
 * past full; with no target, no "/ target" and no bar. The Nutrition screen's hero, and
 * Progress's average day.
 */
export function MacroRows({ macros, accentColor, testIDPrefix = '', spokenSuffix }: Props) {
  return (
    <View style={styles.column}>
      {macros.map((macro, index) => {
        const fraction =
          macro.goal !== null && macro.goal > 0 ? Math.min(macro.consumed / macro.goal, 1) : 0;
        const spoken =
          macro.goal !== null
            ? `${macro.label}, ${wholeFigure(macro.consumed)} of ${wholeFigure(macro.goal)} grams`
            : `${macro.label}, ${wholeFigure(macro.consumed)} grams`;
        return (
          <View
            key={macro.key}
            testID={`${testIDPrefix}${macro.key}-row`}
            style={[styles.row, index > 0 && styles.divider]}
            accessible
            accessibilityLabel={spokenSuffix ? `${spoken} ${spokenSuffix}` : spoken}
          >
            <View style={styles.glyph}>
              <MaterialCommunityIcons
                name={MACRO_GLYPHS[macro.key]}
                size={18}
                color={accentColor}
              />
            </View>
            <View style={styles.body}>
              <Text style={styles.label}>{macro.label}</Text>
              <View style={styles.figures}>
                <Text testID={`${testIDPrefix}${macro.key}-consumed`} style={styles.value}>
                  {grams(macro.consumed)}
                </Text>
                {macro.goal !== null ? (
                  <Text testID={`${testIDPrefix}${macro.key}-goal`} style={styles.goal}>
                    / {grams(macro.goal)}
                  </Text>
                ) : null}
              </View>
              {macro.goal !== null ? (
                <View style={styles.barTrack}>
                  <View
                    testID={`${testIDPrefix}${macro.key}-bar`}
                    style={[
                      styles.barFill,
                      { width: `${fraction * 100}%`, backgroundColor: accentColor },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  glyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLift,
  },
  body: {
    flex: 1,
  },
  label: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  figures: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  value: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  goal: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});
