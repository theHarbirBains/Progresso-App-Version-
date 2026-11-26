import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, fonts, spacing, typeScale } from '../design/theme';

interface Props {
  onPress: () => void;
  accentColor: string;
  testID?: string;
}

/**
 * The Nutrition screen's way to its micronutrients, under protein, carbs and fat in its hero: a row
 * like theirs -- a glyph in a round raised tile, "Micronutrients", "Vitamins & minerals" and a
 * chevron in the accent. No figures of its own: the screen stays on calories and macros, and the
 * vitamins and minerals are a tap away (MicronutrientsScreen).
 */
export function MicronutrientsWidget({
  onPress,
  accentColor,
  testID = 'nutrition-micronutrients',
}: Props) {
  return (
    <View testID={testID} style={styles.wrap}>
      <Pressable
        testID={`${testID}-open`}
        onPress={onPress}
        hitSlop={{ top: 6, bottom: 6 }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Micronutrients. Vitamins, minerals and more."
      >
        <View style={styles.glyph}>
          <MaterialCommunityIcons name="leaf" size={14} color={accentColor} />
        </View>
        <Text style={styles.title}>Micronutrients</Text>
        <Text style={styles.line} numberOfLines={1}>
          Vitamins & minerals
        </Text>
        <Feather name="chevron-right" size={16} color={accentColor} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
  },
  pressed: {
    opacity: 0.7,
  },
  glyph: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLift,
  },
  title: {
    ...typeScale.secondary,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  line: {
    ...typeScale.caption,
    color: colors.textMuted,
    flex: 1,
    textAlign: 'right',
  },
});
