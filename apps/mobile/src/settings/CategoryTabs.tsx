import { ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '../design/Text';
import { Feather } from '@expo/vector-icons';
import { GlassBackground } from '../design/GlassBackground';
import { colors } from '../design/theme';
import { withAlpha } from '../theme/accentColor';
import { settingsStyles as styles } from './settingsStyles';

interface Props<T extends string> {
  /** `icon` is optional per-category -- Settings' own tabs render text-only exactly as before; a caller (Progress) can opt into an icon above the label. */
  categories: { key: T; label: string; icon?: keyof typeof Feather.glyphMap }[];
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
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
            accessibilityRole="button"
            accessibilityLabel={category.label}
            accessibilityState={{ selected }}
          >
            {!selected ? <GlassBackground bordered={false} /> : null}
            {category.icon ? (
              <Feather
                name={category.icon}
                size={16}
                color={selected ? accentColor : colors.textSecondary}
              />
            ) : null}
            <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
