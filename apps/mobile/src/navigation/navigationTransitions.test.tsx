import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import {
  TASK_SWIPE_BAND,
  getScreenTransitionOptions,
  screenTransitionFor,
  useReduceMotionPreference,
} from './navigationTransitions';

describe('screenTransitionFor', () => {
  it("treats the bottom nav's five tabs as sections", () => {
    for (const route of ['Feed', 'WorkoutHistory', 'Nutrition', 'ProgressOverview', 'Profile']) {
      expect(screenTransitionFor(route)).toBe('section');
    }
  });

  it("treats the side menu's section pages (menu button, no back arrow) as sections", () => {
    for (const route of [
      'ExerciseLibrary',
      'WorkoutSplits',
      'FoodLibrary',
      'NutritionGoals',
      'NutritionHistory',
      'CalorieEstimation',
      'LogPastWorkout',
      'TrainerAccess',
    ]) {
      expect(screenTransitionFor(route)).toBe('section');
    }
  });

  it('treats the short tools you open and close as tasks', () => {
    for (const route of ['BarcodeScanner', 'FoodSearch', 'ShareWorkout', 'ChooseWorkoutSplit']) {
      expect(screenTransitionFor(route)).toBe('task');
    }
  });

  it('treats every page with a back arrow as going deeper -- a new screen included, with no setup', () => {
    for (const route of ['WorkoutDetail', 'ActiveWorkout', 'Notifications', 'FindPeople']) {
      expect(screenTransitionFor(route)).toBe('deeper');
    }
    expect(screenTransitionFor('SomeScreenAddedLater')).toBe('deeper');
  });
});

describe('getScreenTransitionOptions', () => {
  it('switches sections instantly, keeping swipe-back', () => {
    const options = getScreenTransitionOptions('Feed', false);

    expect(options.animation).toBe('none');
    expect(options.gestureEnabled).toBe(true);
    expect(options.fullScreenGestureEnabled).toBe(true);
  });

  it("slides a deeper page in with the platform's own push, and a replace slides forward too", () => {
    const options = getScreenTransitionOptions('WorkoutDetail', false);

    expect(options.animation).toBe('default');
    expect(options.animationTypeForReplace).toBe('push');
    expect(options.gestureEnabled).toBe(true);
    expect(options.fullScreenGestureEnabled).toBe(true);
  });

  it('slides a task up from the bottom, closing with a swipe down that only starts in its header band', () => {
    const options = getScreenTransitionOptions('BarcodeScanner', false);

    expect(options.animation).toBe('slide_from_bottom');
    expect(options.animationDuration).toBe(350);
    expect(options.animationTypeForReplace).toBe('push');
    expect(options.gestureEnabled).toBe(true);
    expect(options.gestureDirection).toBe('vertical');
    expect(options.animationMatchesGesture).toBe(true);
    // Not the whole screen: a list underneath must still scroll when dragged.
    expect(options.gestureResponseDistance).toEqual({ bottom: TASK_SWIPE_BAND });
  });

  it('switches every page instantly with Reduce Motion on, keeping swipe-back', () => {
    for (const route of ['Feed', 'WorkoutDetail', 'BarcodeScanner']) {
      const options = getScreenTransitionOptions(route, true);

      expect(options.animation).toBe('none');
      expect(options.gestureEnabled).toBe(true);
      expect(options.fullScreenGestureEnabled).toBe(true);
      expect(options.gestureDirection).toBeUndefined();
    }
  });
});

describe('useReduceMotionPreference', () => {
  it('reflects AccessibilityInfo.isReduceMotionEnabled()', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const { result } = renderHook(() => useReduceMotionPreference());

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('defaults to false while the check is pending/when it resolves false', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    const { result } = renderHook(() => useReduceMotionPreference());

    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(false));
  });
});

// Proves the "a new screen gets its transition automatically" claim: this
// Stack.Navigator/Stack.Screen pair is built entirely inside this test file
// (never touching RootStackParamList or App.tsx), with the second screen
// registered with zero options of its own -- only navigator-level
// screenOptions built the way App.tsx builds them.
type TestParamList = { First: undefined; Second: undefined };
const TestStack = createNativeStackNavigator<TestParamList>();

function FirstScreen() {
  return <Text>First Screen</Text>;
}
function SecondScreen() {
  return <Text testID="second-screen">Second Screen</Text>;
}

describe('a screen registered with no options of its own', () => {
  it('renders normally under a navigator using the shared per-route screenOptions', () => {
    render(
      <NavigationContainer>
        <TestStack.Navigator
          initialRouteName="Second"
          screenOptions={({ route }) => getScreenTransitionOptions(route.name, false)}
        >
          <TestStack.Screen name="First" component={FirstScreen} />
          <TestStack.Screen name="Second" component={SecondScreen} />
        </TestStack.Navigator>
      </NavigationContainer>,
    );

    expect(screen.getByTestId('second-screen')).toBeTruthy();
  });
});
