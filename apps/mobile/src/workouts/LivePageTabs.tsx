import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, radii, spacing, typeScale } from '../design/theme';
import { withAlpha } from '../theme/accentColor';

export interface LivePage {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  /** How many things are on it (the activities on Cardio), shown beside its name once there are any. */
  count?: number;
}

interface Props {
  pages: LivePage[];
  /** The page in view. */
  page: number;
  /** The pages' sideways scroll, so the underline follows a swipe as it happens. */
  scrollX: Animated.Value;
  /** How wide one page is. */
  pageWidth: number;
  onSelect: (index: number) => void;
  accentColor: string;
  testID?: string;
}

/**
 * The live workout's pages -- Lifting and Cardio -- as a tab row under its pinned widget: each a
 * glyph and its name (Cardio with how many activities it holds), divided evenly, the one in view
 * underlined in the accent, the underline sliding with the finger as the pages are swiped. It's
 * what says the workout swipes: tapping a tab goes to its page too.
 */
export function LivePageTabs({
  pages,
  page,
  scrollX,
  pageWidth,
  onSelect,
  accentColor,
  testID = 'live-pages',
}: Props) {
  const [rowWidth, setRowWidth] = useState(0);
  const tabWidth = pages.length > 0 ? rowWidth / pages.length : 0;
  const translateX =
    pageWidth > 0 && pages.length > 1
      ? scrollX.interpolate({
          inputRange: [0, pageWidth * (pages.length - 1)],
          outputRange: [0, tabWidth * (pages.length - 1)],
          extrapolate: 'clamp',
        })
      : 0;
  return (
    <View
      testID={testID}
      style={styles.row}
      accessibilityRole="tablist"
      onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
    >
      {pages.map((tab, index) => {
        const selected = index === page;
        return (
          <Pressable
            key={tab.key}
            testID={`${testID}-${tab.key}`}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            onPress={() => onSelect(index)}
            accessibilityRole="tab"
            accessibilityLabel={tab.count ? `${tab.label}, ${tab.count}` : tab.label}
            accessibilityState={{ selected }}
          >
            <Feather
              name={tab.icon}
              size={16}
              color={selected ? accentColor : colors.textSecondary}
            />
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
            {tab.count ? (
              <View
                testID={`${testID}-${tab.key}-count`}
                style={[styles.count, { backgroundColor: withAlpha(accentColor, 0.16) }]}
              >
                <Text style={[styles.countText, { color: accentColor }]}>{tab.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.underline,
            { width: tabWidth, backgroundColor: accentColor, transform: [{ translateX }] },
          ]}
        />
      ) : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...typeScale.label,
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.textPrimary,
  },
  count: {
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  countText: {
    ...typeScale.caption,
  },
  // Sits over the row's hairline, as UnderlineTabs' does.
  underline: {
    position: 'absolute',
    left: 0,
    bottom: -StyleSheet.hairlineWidth,
    height: 2,
  },
});
