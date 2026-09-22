import { StyleSheet, View } from 'react-native';
import { AppCard } from '../design/AppCard';
import { StatValue } from '../design/StatValue';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale, widgetGap } from '../design/theme';
import { FoodImage } from './FoodImage';

interface FoodFactsTestIDs {
  summary?: string;
  serving?: string;
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
  attribution?: string;
}

interface Props {
  /** Used to choose the food's glyph when it has no photo. */
  name: string;
  /** The food's real photo, when it has one. */
  imageUrl?: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  /** null = the provider genuinely didn't report it -- shown as "—", never a fabricated 0. */
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** Open Food Facts' ODbL license asks integrations to credit the source. */
  showAttribution: boolean;
  /** The Nutrition accent -- used only for the calorie number, the one that matters most. */
  accentColor: string;
  testIDs?: FoodFactsTestIDs;
}

function formatMacro(value: number | null): string {
  return value === null ? '—' : String(value);
}

// One food's nutrition at a glance, shared by every "found a food" view
// (Search Food's detail, Scan Barcode's found product): two widgets `widgetGap`
// apart. The hero holds the food's picture (its photo, or a category glyph),
// the serving as a muted line and the calories as the one large accent
// readout; the second holds protein / carbs / fat as three raised blocks. The
// Open Food Facts credit sits beneath as a caption.
export function FoodFacts({
  name,
  imageUrl,
  servingSize,
  servingUnit,
  calories,
  proteinG,
  carbsG,
  fatG,
  showAttribution,
  accentColor,
  testIDs = {},
}: Props) {
  const macros = [
    { label: 'Protein', value: proteinG, testID: testIDs.protein },
    { label: 'Carbs', value: carbsG, testID: testIDs.carbs },
    { label: 'Fat', value: fatG, testID: testIDs.fat },
  ];
  return (
    <View style={styles.stack}>
      <AppCard hero testID={testIDs.summary}>
        <View style={styles.summaryRow}>
          <FoodImage uri={imageUrl} name={name} size={88} />
          <View style={styles.summaryBody}>
            <Text testID={testIDs.serving} style={styles.serving}>
              Serving: {servingSize} {servingUnit}
            </Text>
            <StatValue
              testID={testIDs.calories}
              value={String(calories)}
              unit=" cal"
              color={accentColor}
            />
          </View>
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.macroRow}>
          {macros.map((macro) => (
            <View key={macro.label} style={styles.macro}>
              <Text style={styles.macroLabel}>{macro.label}</Text>
              <StatValue
                testID={macro.testID}
                size="medium"
                value={formatMacro(macro.value)}
                unit={macro.value === null ? undefined : 'g'}
                color={colors.textPrimary}
              />
            </View>
          ))}
        </View>
      </AppCard>

      {showAttribution ? (
        <Text testID={testIDs.attribution} style={styles.attribution}>
          Data from Open Food Facts
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: widgetGap,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  summaryBody: {
    flex: 1,
  },
  serving: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  macroRow: {
    flexDirection: 'row',
    gap: widgetGap,
  },
  // A raised block, like StatBlock but holding a StatValue so its figure can
  // carry a unit and a testID.
  macro: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
  },
  macroLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  attribution: {
    ...typeScale.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
