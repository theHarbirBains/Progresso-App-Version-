import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { withAlpha } from '../theme/accentColor';
import { settingsStyles as styles } from './settingsStyles';

interface Props<T extends string> {
  categories: { key: T; label: string }[];
  active: T;
  onSelect: (category: T) => void;
  accentColor: string;
  testID?: string;
}

/**
 * The horizontal, scrollable category/section selector -- selected uses the
 * Workout accent, unselected stays neutral. Generic over its category key
 * type so it's reusable anywhere this exact pattern applies (Settings'
 * categories, Progress's sections) rather than each screen re-implementing
 * its own tab bar. Still physically lives alongside settingsStyles.ts
 * (shared visual source of truth for both), not duplicated per caller.
 */
export function CategoryTabs<T extends string>({
  categories,
  active,
  onSelect,
  accentColor,
  testID,
}: Props<T>) {
  return (
    <ScrollView
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabsScroll}
      contentContainerStyle={styles.tabsRow}
    >
      {categories.map((category) => {
        const selected = category.key === active;
        return (
          <TouchableOpacity
            key={category.key}
            testID={testID ? `${testID}-${category.key}` : undefined}
            style={[
              styles.tab,
              selected && {
                backgroundColor: withAlpha(accentColor, 0.14),
                borderColor: accentColor,
              },
            ]}
            onPress={() => onSelect(category.key)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
