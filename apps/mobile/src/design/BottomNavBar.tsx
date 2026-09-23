import { StyleSheet, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassBackground } from './GlassBackground';
import { Text } from './Text';
import { colors, minTouchTarget, spacing, typeScale } from './theme';

export type BottomNavDestination = 'feed' | 'train' | 'nutrition' | 'progress' | 'you';

interface NavItem {
  destination: BottomNavDestination;
  testID: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  /** This tab's own accent when it's the active one -- Train and Nutrition each carry their mode's accent (the same neutral white by default since the black-and-white redesign, or the user's own custom choice per mode). Omit for a neutral tab (Feed/Progress/You), which uses `neutralAccentColor` instead. */
  accentColor?: string;
}

interface Props {
  active: BottomNavDestination;
  onNavigateFeed: () => void;
  onNavigateTrain: () => void;
  onNavigateNutrition: () => void;
  onNavigateProgress: () => void;
  onNavigateYou: () => void;
  workoutAccentColor: string;
  nutritionAccentColor: string;
  /** The accent a mode-agnostic tab (Feed/Progress/You) uses when active -- whichever of Train/Nutrition the user was in most recently. */
  neutralAccentColor: string;
  paddingBottom: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
}

/**
 * THE bottom navigation -- the only one in the app, and the app's sole means
 * of switching between Train and Nutrition content now (there is no
 * Workout/Nutrition toggle any more -- see DESIGN.md's Feed/navigation
 * section). Five fixed tabs, each always the same label/icon regardless of
 * where you are: Feed (the landing screen/personal activity feed), Train,
 * Nutrition, Progress, You. Mounted once in App.tsx as a sibling of the whole
 * screen-stack navigator, so it persists across every push/pop.
 *
 * Normal in-flow layout (not an absolutely-positioned overlay) so the
 * navigator's content area is naturally sized to end above it -- no screen
 * ever needs its own bottom padding to clear it.
 *
 * Train and Nutrition each carry their own fixed accent, so the active tab's
 * colour is always the same regardless of which tab you came from. The
 * mode-agnostic tabs (Feed/Progress/You) use `neutralAccentColor` --
 * whichever of the two you were most recently in.
 *
 * Navigation UI only: it calls back, it does not navigate. It is not a second
 * navigation system on top of the single stack navigator.
 */
export function BottomNavBar({
  active,
  onNavigateFeed,
  onNavigateTrain,
  onNavigateNutrition,
  onNavigateProgress,
  onNavigateYou,
  workoutAccentColor,
  nutritionAccentColor,
  neutralAccentColor,
  paddingBottom,
  onLayout,
  testID,
}: Props) {
  const items: NavItem[] = [
    {
      destination: 'feed',
      testID: 'bottom-nav-feed',
      label: 'Feed',
      icon: 'zap',
      onPress: onNavigateFeed,
    },
    {
      destination: 'train',
      testID: 'bottom-nav-train',
      label: 'Train',
      icon: 'activity',
      onPress: onNavigateTrain,
      accentColor: workoutAccentColor,
    },
    {
      destination: 'nutrition',
      testID: 'bottom-nav-nutrition',
      label: 'Nutrition',
      icon: 'pie-chart',
      onPress: onNavigateNutrition,
      accentColor: nutritionAccentColor,
    },
    {
      destination: 'progress',
      testID: 'bottom-nav-progress',
      label: 'Progress',
      icon: 'trending-up',
      onPress: onNavigateProgress,
    },
    {
      destination: 'you',
      testID: 'bottom-nav-you',
      label: 'You',
      icon: 'user',
      onPress: onNavigateYou,
    },
  ];

  return (
    <View
      testID={testID ?? 'bottom-nav-bar'}
      style={[styles.bar, { paddingBottom }]}
      onLayout={onLayout}
      accessibilityRole="tablist"
    >
      <GlassBackground variant="chrome" bordered={false} />
      {items.map((item) => {
        const selected = item.destination === active;
        const color = selected ? (item.accentColor ?? neutralAccentColor) : colors.textSecondary;
        return (
          <TouchableOpacity
            key={item.destination}
            testID={item.testID}
            style={styles.item}
            onPress={item.onPress}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
          >
            <Feather name={item.icon} size={22} color={color} />
            <Text style={[styles.label, { color }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.glassBorderStrong,
    paddingTop: spacing.sm,
    overflow: 'hidden',
  },
  // A comfortable target: at least 56 wide and 48 tall (the 44pt minimum plus
  // room for the label).
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 56,
    minHeight: minTouchTarget + spacing.xs,
  },
  label: {
    ...typeScale.caption,
  },
});
