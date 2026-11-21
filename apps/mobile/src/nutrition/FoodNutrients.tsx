import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AnimatedBar } from '../design/AnimatedBar';
import { AppCard } from '../design/AppCard';
import { TextButton } from '../design/Button';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale } from '../design/theme';
import { useProfileIfAny } from '../profile/ProfileProvider';
import { fetchFoodMicronutrients } from './foodQueries';
import { displayName } from './micronutrients/display';
import { progressOf } from './micronutrients/intake';
import { NUTRIENTS } from './micronutrients/nutrientCatalog.generated';
import type { NutrientDefinition } from './micronutrients/nutrientTypes';
import {
  formatAmount,
  scaleAmounts,
  unitWithBasis,
  type NutrientAmounts,
  type NutrientId,
} from './micronutrients/nutrients';
import { useReferenceChoices } from './micronutrients/referenceSettings';
import { referencePersonFor, referenceRowFor } from './micronutrients/referenceValues';
import { TopicHeader } from './micronutrients/TopicHeader';

/** Shown before Show All: the ones that matter most for the amount. */
const FIRST_SHOWN = 5;
const ALL_NUTRIENTS: readonly NutrientDefinition[] = NUTRIENTS;

// A food's micronutrients, read once per food a session -- a shared food's don't change under
// the person, and their own foods come with theirs.
const readFor = new Map<string, Promise<NutrientAmounts | null>>();

function readFoodMicronutrients(foodId: string): Promise<NutrientAmounts | null> {
  let read = readFor.get(foodId);
  if (!read) {
    read = (async () => fetchFoodMicronutrients(foodId))();
    readFor.set(foodId, read);
    // A failed read is tried again next time, never remembered.
    read.catch(() => readFor.delete(foodId));
  }
  return read;
}

/** Forgets what was read -- for tests. */
export function forgetFoodMicronutrients() {
  readFor.clear();
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; amounts: NutrientAmounts | null }
  | { status: 'error' };

interface Props {
  foodId: string;
  /** Its micronutrients per serving when in hand; left out, they're read for the food. */
  perServing?: NutrientAmounts | null;
  /** How many servings the figures are for; null while the amount isn't one. */
  servings: number | null;
  accentColor: string;
  testID?: string;
}

/**
 * A food's vitamins and minerals, wherever a food is found and logged (Search Food's page, the
 * log step after a search, a scanned barcode or the Food Library): a widget headed like the
 * Micronutrients pages', each nutrient its data gives for the amount -- its amount and, with the
 * person's details, its share of their daily target as a bar that stops at full -- the largest
 * shares first, five to start and Show All for the rest. A nutrient the data doesn't give isn't
 * listed (never 0); with none at all, it says so.
 */
export function FoodNutrients({
  foodId,
  perServing,
  servings,
  accentColor,
  testID = 'food-nutrients',
}: Props) {
  const [state, setState] = useState<State>(() =>
    perServing !== undefined ? { status: 'ready', amounts: perServing } : { status: 'loading' },
  );
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (perServing !== undefined) {
      setState({ status: 'ready', amounts: perServing });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    readFoodMicronutrients(foodId)
      .then((amounts) => {
        if (!cancelled) setState({ status: 'ready', amounts });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [foodId, perServing]);

  const profile = useProfileIfAny();
  const { choices } = useReferenceChoices(profile?.id);
  const { person } = referencePersonFor(profile, choices);

  const amounts =
    state.status === 'ready' && servings !== null ? scaleAmounts(state.amounts, servings) : null;
  const rows = ALL_NUTRIENTS.flatMap((nutrient) => {
    const amount = amounts?.[nutrient.id as NutrientId];
    if (amount === undefined) return [];
    const target = nutrient.guidance ? null : (referenceRowFor(nutrient.id, person)?.value ?? null);
    const { percent, fraction } = progressOf(amount, target);
    return [{ nutrient, amount, percent: target === null ? null : percent, fraction }];
  }).sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
  const shown = showAll ? rows : rows.slice(0, FIRST_SHOWN);

  return (
    <AppCard testID={testID}>
      <View style={styles.body}>
        <TopicHeader
          icon="droplet"
          title="Vitamins & Minerals"
          detail={rows.length > 0 ? `${rows.length} with data · % of your daily target` : null}
          accentColor={accentColor}
        />
        {state.status === 'loading' ? (
          <SkeletonRows testID={`${testID}-loading`} count={2} />
        ) : state.status === 'error' ? (
          <Text testID={`${testID}-error`} style={styles.quiet}>
            Couldn’t load its vitamins and minerals.
          </Text>
        ) : servings === null ? (
          <Text style={styles.quiet}>Enter an amount to see them.</Text>
        ) : rows.length === 0 ? (
          <Text testID={`${testID}-none`} style={styles.quiet}>
            No vitamin or mineral data for this food — it won’t add to your micronutrients.
          </Text>
        ) : (
          <>
            {shown.map(({ nutrient, amount, percent, fraction }) => (
              <View
                key={nutrient.id}
                testID={`${testID}-${nutrient.id}`}
                style={styles.row}
                accessible
                accessibilityLabel={`${displayName(nutrient)}: ${formatAmount(amount)} ${unitWithBasis(nutrient)}${
                  percent !== null ? `, ${percent}% of your daily target` : ''
                }`}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {displayName(nutrient)}
                  </Text>
                  <Text style={styles.amount}>
                    {formatAmount(amount)} {unitWithBasis(nutrient)}
                  </Text>
                  {percent !== null ? (
                    <Text style={[styles.percent, { color: accentColor }]}>{percent}%</Text>
                  ) : null}
                </View>
                {percent !== null ? <AnimatedBar fraction={fraction} color={accentColor} /> : null}
              </View>
            ))}
            {rows.length > FIRST_SHOWN ? (
              <TextButton
                testID={`${testID}-all`}
                label={showAll ? 'Show Less' : `Show All ${rows.length}`}
                onPress={() => setShowAll((open) => !open)}
              />
            ) : null}
          </>
        )}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.xs,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  name: {
    ...typeScale.callout,
    color: colors.textPrimary,
    flex: 1,
  },
  amount: {
    ...typeScale.secondary,
    fontFamily: fonts.mono,
    color: colors.textSecondary,
  },
  percent: {
    ...typeScale.secondary,
    fontFamily: fonts.mono,
    minWidth: 40,
    textAlign: 'right',
  },
  quiet: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
});
