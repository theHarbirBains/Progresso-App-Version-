import { StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassBackground } from './GlassBackground';
import { colors, radii, spacing } from './theme';

export type BottomNavDestination = 'home' | 'workouts' | 'progress' | 'profile';

interface Props {
  active: BottomNavDestination;
  /** Which mode's tabs to show -- Workouts/Progress in Workout mode, Food/Goals in Nutrition mode, mirroring Dashboard's own copy of this bar (see DashboardScreen.tsx). Drives the second and third tab's label/icon only; Home and Profile stay the same in both modes. */
  mode: 'workout' | 'nutrition';
  accentColor: string;
  onAccentColor: string;
  onNavigateHome: () => void;
  onNavigateWorkouts: () => void;
  onNavigateProgress: () => void;
  onNavigateProfile: () => void;
  onPressPlus: () => void;
  paddingBottom: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
}

/**
 * The persistent bottom bar, mounted once in App.tsx as a sibling of the
 * whole screen-stack navigator (Home/Dashboard keeps its own copy instead,
 * since it additionally crossfades between the Workout and Nutrition accent
 * as its own mode toggle changes -- a static single-accent bar like this one
 * doesn't need that animation). Normal in-flow layout (not an absolutely-
 * positioned overlay) so the navigator's content area is naturally sized to
 * leave room for it -- no per-screen padding math required. Purely
 * decorative navigation UI on top of the single existing stack navigator --
 * not a second navigation system.
 */
export function BottomNavBar({
  active,
  mode,
  accentColor,
  onAccentColor,
  onNavigateHome,
  onNavigateWorkouts,
  onNavigateProgress,
  onNavigateProfile,
  onPressPlus,
  paddingBottom,
  onLayout,
  testID,
}: Props) {
  function itemColor(destination: BottomNavDestination) {
    return destination === active ? accentColor : colors.textSecondary;
  }
  const workoutsLabel = mode === 'workout' ? 'Workouts' : 'Food';
  const workoutsIcon = mode === 'workout' ? 'activity' : 'pie-chart';
  const progressLabel = mode === 'workout' ? 'Progress' : 'Goals';
  const progressIcon = mode === 'workout' ? 'trending-up' : 'target';

  return (
    <View
      testID={testID ?? 'bottom-nav-bar'}
      style={[styles.bar, { paddingBottom }]}
      onLayout={onLayout}
    >
      <GlassBackground variant="chrome" bordered={false} />
      <TouchableOpacity
        testID="bottom-nav-home"
        style={styles.item}
        onPress={onNavigateHome}
        accessibilityRole="button"
        accessibilityState={{ selected: active === 'home' }}
      >
        <Feather name="home" size={20} color={itemColor('home')} />
        <Text style={[styles.label, { color: itemColor('home') }]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="bottom-nav-workouts"
        style={styles.item}
        onPress={onNavigateWorkouts}
        accessibilityRole="button"
        accessibilityState={{ selected: active === 'workouts' }}
      >
        <Feather name={workoutsIcon} size={20} color={itemColor('workouts')} />
        <Text style={[styles.label, { color: itemColor('workouts') }]}>{workoutsLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="bottom-nav-plus"
        style={[styles.center, { backgroundColor: accentColor }]}
        onPress={onPressPlus}
        accessibilityRole="button"
        accessibilityLabel="Quick actions"
      >
        <Feather name="plus" size={22} color={onAccentColor} />
      </TouchableOpacity>

      <TouchableOpacity
        testID="bottom-nav-progress"
        style={styles.item}
        onPress={onNavigateProgress}
        accessibilityRole="button"
        accessibilityState={{ selected: active === 'progress' }}
      >
        <Feather name={progressIcon} size={20} color={itemColor('progress')} />
        <Text style={[styles.label, { color: itemColor('progress') }]}>{progressLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="bottom-nav-profile"
        style={styles.item}
        onPress={onNavigateProfile}
        accessibilityRole="button"
        accessibilityState={{ selected: active === 'profile' }}
      >
        <Feather name="user" size={20} color={itemColor('profile')} />
        <Text style={[styles.label, { color: itemColor('profile') }]}>Profile</Text>
      </TouchableOpacity>
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
  item: {
    alignItems: 'center',
    gap: 2,
    minWidth: 48,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Raised less than before (was -20) -- `bar`'s own overflow:'hidden'
  // (needed to clip its chrome blur) was clipping the top of this circle
  // whenever it poked that far above the bar's own bounds.
  center: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
});
