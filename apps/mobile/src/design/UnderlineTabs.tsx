import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './Text';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, typeScale } from './theme';

interface Props<T extends string> {
  categories: { key: T; label: string; icon: keyof typeof Feather.glyphMap }[];
  active: T;
  onSelect: (category: T) => void;
  accentColor: string;
  testID?: string;
}

/**
 * A full-width tab row -- icon stacked above its label, the active tab
 * marked by a colored underline beneath it rather than a filled pill.
 * This is the exact Strava tab treatment its You/profile screen uses for
 * its Progress/Activities/Gallery/More row (see DESIGN.md's You/Profile
 * section), reproduced verbatim by explicit request.
 *
 * Divides the full row evenly and never scrolls, which only makes sense
 * for a small, fixed set of tabs that should always all be visible (like
 * Profile's Workouts/Stats/PRs, or Progress's Overview/Top Sets/Strength/
 * All Time) -- not a fit for an unbounded or scrolling tab set.
 */
export function UnderlineTabs<T extends string>({
  categories,
  active,
  onSelect,
  accentColor,
  testID,
}: Props<T>) {
  return (
    <View testID={testID} style={styles.row}>
      {categories.map((category) => {
        const selected = category.key === active;
        return (
          <TouchableOpacity
            key={category.key}
            testID={testID ? `${testID}-${category.key}` : undefined}
            style={[styles.tab, selected && { borderBottomColor: accentColor }]}
            onPress={() => onSelect(category.key)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={category.label}
            accessibilityState={{ selected }}
          >
            <Feather
              name={category.icon}
              size={18}
              color={selected ? accentColor : colors.textSecondary}
            />
            <Text
              style={[
                styles.label,
                { color: selected ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              {category.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    // Sit 1px below the row's own hairline divider so a selected tab's
    // colored underline draws on top of it rather than the two competing
    // for the same pixel row.
    marginBottom: -StyleSheet.hairlineWidth,
  },
  label: {
    ...typeScale.caption,
  },
});
