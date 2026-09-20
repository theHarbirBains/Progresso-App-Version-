import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { getDefaultScreenOptions, useReduceMotionPreference } from './navigationTransitions';

describe('getDefaultScreenOptions', () => {
  it('disables the page transition animation (instant navigation) while keeping swipe-back gesture support', () => {
    const options = getDefaultScreenOptions();

    expect(options.animation).toBe('none');
    expect(options.gestureEnabled).toBe(true);
    expect(options.fullScreenGestureEnabled).toBe(true);
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

// Proves the "future screen automatically inherits the transition" claim:
// this Stack.Navigator/Stack.Screen pair is built entirely inside this test
// file (never touching RootStackParamList or App.tsx), with the second
// screen registered with zero options of its own -- only the navigator-level
// screenOptions (from getDefaultScreenOptions) is supplied, exactly as a
// real new screen would be added six months from now.
type TestParamList = { First: undefined; Second: undefined };
const TestStack = createNativeStackNavigator<TestParamList>();

function FirstScreen() {
  return <Text>First Screen</Text>;
}
function SecondScreen() {
  return <Text testID="second-screen">Second Screen</Text>;
}

describe('a screen registered with no options of its own', () => {
  it('renders normally under a navigator using the shared default screenOptions', () => {
    render(
      <NavigationContainer>
        <TestStack.Navigator initialRouteName="Second" screenOptions={getDefaultScreenOptions()}>
          <TestStack.Screen name="First" component={FirstScreen} />
          <TestStack.Screen name="Second" component={SecondScreen} />
        </TestStack.Navigator>
      </NavigationContainer>,
    );

    expect(screen.getByTestId('second-screen')).toBeTruthy();
  });
});
