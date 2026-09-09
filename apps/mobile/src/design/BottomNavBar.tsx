import { StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from './theme';

export type BottomNavDestination = 'home' | 'workouts' | 'progress' | 'social';

interface Props {
  active: BottomNavDestination;
  accentColor: string;
  onAccentColor: string;
  onNavigateHome: () => void;
  onNavigateWorkouts: () => void;
  onNavigateProgress: () => void;
  onNavigateSocial: () => void;
  onPressPlus: () => void;
  paddingBottom: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
}

/**
 * The shared 5-item bottom bar for Workouts and Social (Home/Dashboard keeps
 * its own copy, since it additionally crossfades between the Workout and
 * Nutrition accent as its own mode toggle changes -- a static single-accent
 * bar like this one doesn't need that animation). Purely decorative
 * navigation UI on top of the single existing stack navigator -- not a
 * second navigation system.
 */
export function BottomNavBar({
  active,
  accentColor,
  onAccentColor,
  onNavigateHome,
  onNavigateWorkouts,
  onNavigateProgress,
  onNavigateSocial,
  onPressPlus,
  paddingBottom,
  onLayout,
  testID,
}: Props) {
  function itemColor(destination: BottomNavDestination) {
    return destination === active ? accentColor : colors.textMuted;
  }

  return (
    <View
      testID={testID ?? 'bottom-nav-bar'}
      style={[styles.bar, { paddingBottom }]}
      onLayout={onLayout}
    >
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
        <Feather name="activity" size={20} color={itemColor('workouts')} />
        <Text style={[styles.label, { color: itemColor('workouts') }]}>Workouts</Text>
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
        <Feather name="trending-up" size={20} color={itemColor('progress')} />
        <Text style={[styles.label, { color: itemColor('progress') }]}>Progress</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="bottom-nav-social"
        style={styles.item}
        onPress={onNavigateSocial}
        accessibilityRole="button"
        accessibilityState={{ selected: active === 'social' }}
      >
        <Feather name="users" size={20} color={itemColor('social')} />
        <Text style={[styles.label, { color: itemColor('social') }]}>Social</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    zIndex: 10,
    elevation: 10,
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
  center: {
    width: 46,
    height: 46,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
});
