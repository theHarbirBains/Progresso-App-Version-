import { getStateFromPath, NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { act, render, screen } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { Text } from 'react-native';
import { isAuthLink, LINK_CONFIG, useAppLinking } from './linking';
import type { RootStackParamList } from './types';

const mockGetInitialURL = Linking.getInitialURL as jest.Mock;
const mockAddEventListener = Linking.addEventListener as jest.Mock;

describe('LINK_CONFIG', () => {
  it.each([
    ['feed', ['Feed']],
    ['nutrition', ['Feed', 'Nutrition']],
    ['workouts/w-1', ['Feed', 'WorkoutDetail']],
    ['workouts/w-1/live', ['Feed', 'ActiveWorkout']],
    // The Next Workout widget's Start, and a group workout's Resume.
    ['workouts/new', ['Feed', 'NewWorkout']],
    ['groups/g-1', ['Feed', 'GroupSession']],
  ])('opens %s on top of Feed', (path, routes) => {
    const state = getStateFromPath(path, LINK_CONFIG);

    expect(state?.routes.map((route) => route.name)).toEqual(routes);
  });

  it('gives the workout screens the workout id from the link', () => {
    expect(getStateFromPath('workouts/w-1', LINK_CONFIG)?.routes[1]?.params).toEqual({
      workoutId: 'w-1',
    });
    expect(getStateFromPath('workouts/w-1/live', LINK_CONFIG)?.routes[1]?.params).toEqual({
      workoutId: 'w-1',
    });
    expect(getStateFromPath('groups/g-1', LINK_CONFIG)?.routes[1]?.params).toEqual({
      groupId: 'g-1',
    });
  });

  it('opens nothing for a path that names no screen', () => {
    expect(getStateFromPath('somewhere/else', LINK_CONFIG)).toBeUndefined();
  });
});

describe('isAuthLink', () => {
  it('recognises the sign-in, confirmation and password reset links, tokens and all', () => {
    expect(isAuthLink('progresso://auth-callback#access_token=a&refresh_token=b')).toBe(true);
    expect(isAuthLink('progresso://confirm-email#access_token=a&refresh_token=b')).toBe(true);
    expect(isAuthLink('progresso://reset-password#access_token=a&type=recovery')).toBe(true);
    expect(isAuthLink('exp://192.168.1.5:8081/--/reset-password#access_token=a')).toBe(true);
  });

  it('does not treat a link to a screen as one', () => {
    expect(isAuthLink('progresso://workouts/w-1')).toBe(false);
    expect(isAuthLink('progresso://nutrition')).toBe(false);
    expect(isAuthLink('exp://192.168.1.5:8081/--/feed')).toBe(false);
  });
});

const Stack = createNativeStackNavigator<RootStackParamList>();

function FeedStub() {
  return <Text>Feed screen</Text>;
}
function NutritionStub() {
  return <Text>Nutrition screen</Text>;
}
function WorkoutDetailStub({ route }: NativeStackScreenProps<RootStackParamList, 'WorkoutDetail'>) {
  return <Text>{`Workout ${route.params.workoutId}`}</Text>;
}
function ActiveWorkoutStub({ route }: NativeStackScreenProps<RootStackParamList, 'ActiveWorkout'>) {
  return <Text>{`Live ${route.params.workoutId}`}</Text>;
}

/** The app's shape: the navigator only exists while signed in, as in App.tsx's Root. */
function TestApp({ signedIn }: { signedIn: boolean }) {
  const linking = useAppLinking(signedIn);
  if (!signedIn) return <Text>Sign in</Text>;
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator initialRouteName="Feed">
        <Stack.Screen name="Feed" component={FeedStub} />
        <Stack.Screen name="Nutrition" component={NutritionStub} />
        <Stack.Screen name="WorkoutDetail" component={WorkoutDetailStub} />
        <Stack.Screen name="ActiveWorkout" component={ActiveWorkoutStub} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/** A link arriving while the app is running, the way the OS delivers one. */
function openLink(url: string) {
  const handler = mockAddEventListener.mock.calls.at(-1)?.[1] as
    ((event: { url: string }) => void) | undefined;
  if (!handler) throw new Error('nothing is listening for links');
  act(() => handler({ url }));
}

describe('useAppLinking', () => {
  beforeEach(() => {
    mockGetInitialURL.mockReset().mockResolvedValue(null);
    mockAddEventListener.mockClear();
  });

  it('opens the screen the launch link names, on top of Feed', async () => {
    mockGetInitialURL.mockResolvedValue('progresso://workouts/w-42');
    render(<TestApp signedIn />);

    expect(await screen.findByText('Workout w-42')).toBeTruthy();
  });

  it('starts on Feed when the app was opened without a link', async () => {
    render(<TestApp signedIn />);

    expect(await screen.findByText('Feed screen')).toBeTruthy();
  });

  it('waits for sign-in: a link that arrives while signed out opens once signed in', async () => {
    const { rerender } = render(<TestApp signedIn={false} />);

    openLink('progresso://workouts/w-7/live');
    rerender(<TestApp signedIn />);

    expect(await screen.findByText('Live w-7')).toBeTruthy();
  });

  it('opens the launch link only once, so signing out and back in starts on Feed', async () => {
    mockGetInitialURL.mockResolvedValue('progresso://nutrition');
    const { rerender } = render(<TestApp signedIn />);
    expect(await screen.findByText('Nutrition screen')).toBeTruthy();

    rerender(<TestApp signedIn={false} />);
    rerender(<TestApp signedIn />);

    expect(await screen.findByText('Feed screen')).toBeTruthy();
    expect(screen.queryByText('Nutrition screen')).toBeNull();
  });

  it('leaves the auth links to AuthProvider, whether they launched the app or arrived later', async () => {
    mockGetInitialURL.mockResolvedValue(
      'progresso://reset-password#access_token=a&refresh_token=b&type=recovery',
    );
    const { rerender } = render(<TestApp signedIn={false} />);

    openLink('progresso://confirm-email#access_token=a&refresh_token=b');
    rerender(<TestApp signedIn />);

    expect(await screen.findByText('Feed screen')).toBeTruthy();
  });

  it('stops holding links once signed in, when the navigator listens for them itself', async () => {
    const remove = jest.fn();
    mockAddEventListener.mockReturnValueOnce({ remove });
    const { rerender } = render(<TestApp signedIn={false} />);

    rerender(<TestApp signedIn />);

    expect(remove).toHaveBeenCalled();
    expect(await screen.findByText('Feed screen')).toBeTruthy();
  });
});
