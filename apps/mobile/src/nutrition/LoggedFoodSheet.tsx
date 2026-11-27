import { useRef } from 'react';
import { InputAccessoryView, Keyboard, Platform, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton, TextButton } from '../design/Button';
import { IconButton } from '../design/IconButton';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { FoodImage } from './FoodImage';
import type { FoodLogRow } from './foodLogQueries';
import { servingMeasures, unitWord } from './logQuantity';
import { wholeFigure } from './wholeFigures';

// Links the amount field to the check above the number pad (iPhone).
export const AMOUNT_DONE_ID = 'food-log-amount-done';

interface Props {
  /** The food open, or null for none. */
  log: FoodLogRow | null;
  /** Whether the day shown is today, for Delete's wording. */
  isToday: boolean;
  /** The amount as it's being typed. */
  amount: string;
  onChangeAmount: (text: string) => void;
  /** The amount finished (the keyboard gone, or Done): it's saved. */
  onSaveAmount: () => void;
  /** Takes this food off the day -- only this entry; the food stays in the library. */
  onDelete: () => void;
  /** Done, a swipe down or a tap outside: the amount typed is saved, then it closes. */
  onClose: () => void;
  accentColor: string;
  onAccentColor: string;
}

/**
 * A food of the day's, opened from its card: its picture (tapped to see it full screen), its name
 * and when it was logged, its calories, protein, carbs and fat for the amount logged, the amount
 * to change (as typed -- "2" cookies, "150" g; 0 takes it off the day), Done, and a quiet Delete.
 */
export function LoggedFoodSheet({
  log,
  isToday,
  amount,
  onChangeAmount,
  onSaveAmount,
  onDelete,
  onClose,
  accentColor,
  onAccentColor,
}: Props) {
  // The last food open stays drawn while the sheet slides away.
  const lastShown = useRef<FoodLogRow | null>(null);
  if (log) lastShown.current = log;
  const shown = log ?? lastShown.current;

  const figures = shown
    ? [
        {
          key: 'calories',
          glyph: 'fire',
          value: `${wholeFigure(shown.calories)}`,
          label: 'Calories',
        },
        {
          key: 'protein',
          glyph: 'food-drumstick-outline',
          value: `${wholeFigure(shown.proteinG)}g`,
          label: 'Protein',
        },
        { key: 'carbs', glyph: 'barley', value: `${wholeFigure(shown.carbsG)}g`, label: 'Carbs' },
        { key: 'fat', glyph: 'water-outline', value: `${wholeFigure(shown.fatG)}g`, label: 'Fat' },
      ]
    : [];

  return (
    <BottomSheet visible={log !== null} onClose={onClose} swipeToDismiss testID="food-log-sheet">
      {shown ? (
        <View style={styles.content}>
          <View style={styles.head}>
            <FoodImage
              testID={`food-log-sheet-image-${shown.id}`}
              uri={shown.imageUrl}
              name={shown.foodNameSnapshot}
              size={72}
              zoomable
            />
            <View style={styles.headText}>
              <Text style={styles.title} numberOfLines={2}>
                {shown.foodNameSnapshot}
              </Text>
              <Text style={styles.when}>
                Logged at{' '}
                {new Date(shown.loggedAt).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          <View testID={`food-log-figures-${shown.id}`} style={styles.figures}>
            {figures.map((figure) => (
              <View
                key={figure.key}
                style={styles.figure}
                accessible
                accessibilityLabel={`${figure.label}, ${figure.value}`}
              >
                <View style={styles.figureLine}>
                  <MaterialCommunityIcons
                    name={figure.glyph as keyof typeof MaterialCommunityIcons.glyphMap}
                    size={14}
                    color={accentColor}
                  />
                  <Text style={styles.figureValue} numberOfLines={1}>
                    {figure.value}
                  </Text>
                </View>
                <Text style={styles.figureLabel}>{figure.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Amount</Text>
            <TextInput
              testID={`food-log-quantity-${shown.id}`}
              style={styles.amountInput}
              accessibilityLabel={`Amount of ${shown.foodNameSnapshot}, in ${unitWord(
                2,
                shown.enteredUnit ?? 'servings',
                servingMeasures(shown).pieces,
              )}`}
              accessibilityHint="Enter 0 to take it off the day."
              keyboardType="decimal-pad"
              returnKeyType="done"
              inputAccessoryViewID={AMOUNT_DONE_ID}
              value={amount}
              onChangeText={onChangeAmount}
              onEndEditing={onSaveAmount}
            />
            <Text testID={`food-log-unit-${shown.id}`} style={styles.amountUnit} numberOfLines={1}>
              {unitWord(
                shown.enteredAmount ?? shown.quantity,
                shown.enteredUnit ?? 'servings',
                servingMeasures(shown).pieces,
              )}
            </Text>
          </View>

          <PrimaryButton
            testID="food-log-sheet-done"
            label="Done"
            onPress={onClose}
            accentColor={accentColor}
            onAccentColor={onAccentColor}
          />
          <View style={styles.delete}>
            <TextButton
              testID={`food-log-delete-${shown.id}`}
              label={isToday ? 'Delete from Today' : 'Delete from This Day'}
              accessibilityLabel={`Delete ${shown.foodNameSnapshot}`}
              destructive
              onPress={onDelete}
            />
          </View>

          {/* iPhone's number pad has no key to finish with: a check on the bar above it saves the
              amount typed (it ends the editing, which saves). Android's has its own. */}
          {Platform.OS === 'ios' ? (
            <InputAccessoryView nativeID={AMOUNT_DONE_ID}>
              <View style={styles.amountBar}>
                <IconButton
                  testID="food-log-amount-save"
                  icon="check"
                  accessibilityLabel="Save amount"
                  color={accentColor}
                  onPress={() => Keyboard.dismiss()}
                />
              </View>
            </InputAccessoryView>
          ) : null}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  when: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
  // Its calories, protein, carbs and fat, four raised tiles -- as Daily Targets'.
  figures: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  figure: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
  },
  figureLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: '100%',
  },
  figureValue: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  figureLabel: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amountLabel: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    flex: 1,
  },
  amountInput: {
    width: 72,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    ...typeScale.statSmall,
    textAlign: 'center',
  },
  amountUnit: {
    ...typeScale.callout,
    color: colors.textSecondary,
    maxWidth: 110,
  },
  delete: {
    alignItems: 'center',
  },
  // The bar above the number pad, with its one check at the right.
  amountBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
});
