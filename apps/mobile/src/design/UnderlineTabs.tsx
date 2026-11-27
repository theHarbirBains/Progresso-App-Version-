import { useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { Text } from './Text';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, spacing, typeScale } from './theme';

interface Props<T extends string> {
  categories: { key: T; label: string; icon: keyof typeof Feather.glyphMap }[];
  active: T;
  onSelect: (category: T) => void;
  accentColor: string;
  /**
   * Labels only, in one line that slides sideways when the tabs don't all fit -- the selected one
   * kept in view (Progress's many sections). Otherwise icons over labels, dividing the row evenly.
   */
  compact?: boolean;
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
  compact = false,
  testID,
}: Props<T>) {
  if (compact) {
    return (
      <CompactTabs
        categories={categories}
        active={active}
        onSelect={onSelect}
        accentColor={accentColor}
        testID={testID}
      />
    );
  }
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

/** Labels only, sliding sideways when they don't fit; filling the row evenly when they do. */
function CompactTabs<T extends string>({
  categories,
  active,
  onSelect,
  accentColor,
  testID,
}: Omit<Props<T>, 'compact'>) {
  const scroll = useRef<ScrollViewInstance>(null);
  // Where each tab starts and how wide it is, to keep the selected one in view.
  const spots = useRef(new Map<T, { x: number; width: number }>());
  const rowWidth = useRef(0);
  const reveal = (key: T, animated: boolean) => {
    const spot = spots.current.get(key);
    if (!spot || !scroll.current) return;
    const x = Math.max(0, spot.x - (rowWidth.current - spot.width) / 2);
    scroll.current.scrollTo({ x, animated });
  };
  useEffect(() => {
    reveal(active, true);
    // Only when the selected tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <View testID={testID} style={styles.row}>
      <ScrollView
        ref={scroll}
        horizontal
        keyboardDismissMode="on-drag"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactContent}
        onLayout={(event) => {
          rowWidth.current = event.nativeEvent.layout.width;
        }}
      >
        {categories.map((category) => {
          const selected = category.key === active;
          return (
            <TouchableOpacity
              key={category.key}
              testID={testID ? `${testID}-${category.key}` : undefined}
              style={[styles.compactTab, selected && { borderBottomColor: accentColor }]}
              onPress={() => onSelect(category.key)}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                spots.current.set(category.key, { x, width });
                if (selected) reveal(category.key, false);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={category.label}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.compactLabel,
                  selected
                    ? { color: colors.textPrimary, fontFamily: fonts.semibold }
                    : { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
  // Compact: as wide as their labels, sharing out any room left over.
  compactContent: {
    flexGrow: 1,
  },
  compactTab: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -StyleSheet.hairlineWidth,
  },
  compactLabel: {
    ...typeScale.label,
  },
});
