import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { FoodImage } from './FoodImage';
import type { FoodLogRow } from './foodLogQueries';
import { amountText, servingMeasures } from './logQuantity';
import { wholeFigure } from './wholeFigures';

/**
 * A food card's width. About one and a half show across a phone, so the row plainly carries on
 * to the side.
 */
export const FOOD_CARD_WIDTH = 216;
const CARD_GAP = spacing.sm;
const PICTURE = 52;

/** The three macros' glyphs, the page's own (a drumstick, barley, a drop). */
const MACRO_GLYPHS = [
  { key: 'protein', glyph: 'food-drumstick-outline', of: (log: FoodLogRow) => log.proteinG },
  { key: 'carbs', glyph: 'barley', of: (log: FoodLogRow) => log.carbsG },
  { key: 'fat', glyph: 'water-outline', of: (log: FoodLogRow) => log.fatG },
] as const;

/** A quiet tile after the foods: Copy Yesterday, Save as Meal. */
export interface FoodCarouselShortcut {
  key: string;
  testID: string;
  label: string;
  spoken: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}

interface Props {
  logs: FoodLogRow[];
  accentColor: string;
  /** A food tapped: its sheet, to change the amount or delete it. */
  onOpen: (log: FoodLogRow) => void;
  /** VoiceOver's Delete, on each card. */
  onDelete: (log: FoodLogRow) => void;
  shortcuts: FoodCarouselShortcut[];
  /** How far the row reaches past its card's padding, so the cards scroll right to its edges. */
  bleed: number;
  /** Marks where a sideways drag belongs to the foods, not the page's turn of the day. */
  swipeZone: {
    onTouchStart: () => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
  reduceMotion: boolean;
  testID?: string;
}

/** A log's amount as it was typed, or in servings: "2 cookies", "150 g", "1 serving". */
export function logAmountText(log: FoodLogRow): string {
  return amountText(
    log.enteredAmount ?? log.quantity,
    log.enteredUnit ?? 'servings',
    servingMeasures(log).pieces,
  );
}

/**
 * The day's foods as a row of cards, scrolled sideways either way, in the order they were logged:
 * each its picture, its name, its calories in the accent with the amount beside them, and its
 * protein, carbs and fat by their glyphs. A tap opens it (its amount, Delete). Copy Yesterday and
 * Save as Meal follow the foods as quiet tiles. A food logged while the row is on screen is scrolled
 * into view.
 */
export function FoodCarousel({
  logs,
  accentColor,
  onOpen,
  onDelete,
  shortcuts,
  bleed,
  swipeZone,
  reduceMotion,
  testID = 'nutrition-today-foods-scroll',
}: Props) {
  const scroll = useRef<ScrollViewInstance>(null);
  // The foods already shown: one that wasn't is new, and comes into view. The first render only
  // records them.
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    const before = known.current;
    known.current = new Set(logs.map((log) => log.id));
    if (!before) return;
    const index = logs.findIndex((log) => !before.has(log.id));
    if (index < 0) return;
    scroll.current?.scrollTo({ x: index * (FOOD_CARD_WIDTH + CARD_GAP), animated: !reduceMotion });
  }, [logs, reduceMotion]);

  return (
    <View {...swipeZone} style={[styles.zone, { marginHorizontal: -bleed }]}>
      <ScrollView
        ref={scroll}
        horizontal
        keyboardDismissMode="on-drag"
        testID={testID}
        style={styles.scroll}
        contentContainerStyle={[styles.row, { paddingHorizontal: bleed }]}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={logs.map((_, index) => index * (FOOD_CARD_WIDTH + CARD_GAP))}
        keyboardShouldPersistTaps="handled"
      >
        {logs.map((log) => {
          const amount = logAmountText(log);
          const calories = wholeFigure(log.calories);
          return (
            <Pressable
              key={log.id}
              testID={`food-log-row-${log.id}`}
              onPress={() => onOpen(log)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${log.foodNameSnapshot}, ${amount}: ${calories} calories, ${wholeFigure(
                log.proteinG,
              )} grams protein, ${wholeFigure(log.carbsG)} grams carbs, ${wholeFigure(log.fatG)} grams fat`}
              accessibilityHint="Opens it, to change the amount or delete it."
              accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'delete') onDelete(log);
              }}
            >
              <FoodImage
                testID={`food-log-image-${log.id}`}
                uri={log.imageUrl}
                name={log.foodNameSnapshot}
                size={PICTURE}
              />
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {log.foodNameSnapshot}
                </Text>
                <View style={styles.calorieLine}>
                  <Text style={[styles.calories, { color: accentColor }]}>
                    {calories}
                    <Text style={styles.calorieUnit}> cal</Text>
                  </Text>
                  <Text
                    testID={`food-log-amount-${log.id}`}
                    style={styles.amount}
                    numberOfLines={1}
                  >
                    {amount}
                  </Text>
                </View>
                <View style={styles.macros}>
                  {MACRO_GLYPHS.map((macro) => (
                    <View key={macro.key} style={styles.macro}>
                      <MaterialCommunityIcons name={macro.glyph} size={12} color={accentColor} />
                      <Text style={styles.macroValue}>{wholeFigure(macro.of(log))}g</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Pressable>
          );
        })}
        {shortcuts.map((shortcut) => (
          <Pressable
            key={shortcut.key}
            testID={shortcut.testID}
            onPress={shortcut.onPress}
            style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={shortcut.spoken}
          >
            <Feather name={shortcut.icon} size={18} color={accentColor} />
            <Text style={styles.shortcutLabel} numberOfLines={2}>
              {shortcut.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Whatever height the foods card has left; the cards stand the full height of it.
  zone: {
    flexGrow: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  row: {
    gap: CARD_GAP,
  },
  card: {
    width: FOOD_CARD_WIDTH,
    minHeight: PICTURE + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  pressed: {
    opacity: 0.7,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  name: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  calorieLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  calories: {
    ...typeScale.statSmall,
  },
  calorieUnit: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  amount: {
    ...typeScale.caption,
    color: colors.textMuted,
    flexShrink: 1,
  },
  macros: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  macroValue: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  // Copy Yesterday and Save as Meal: narrow outlined tiles, like Log Food's.
  shortcut: {
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  shortcutLabel: {
    ...typeScale.caption,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
