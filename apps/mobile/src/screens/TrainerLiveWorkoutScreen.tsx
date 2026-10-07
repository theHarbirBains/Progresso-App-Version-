import { Alert, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, TextButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { colors, typeScale } from '../design/theme';
import { cancelLiveWorkout, finishLiveWorkout, resolveClientExercise } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { LiveWorkoutEditor } from '../workouts/LiveWorkoutEditor';

type Props = RootStackScreenProps<'TrainerLiveWorkout'>;

/**
 * A live session the trainer runs for a client, as it happens. Changes save as they
 * are made, and the session stays open until the trainer finishes it. Exercises the
 * trainer picks are resolved to the client's copies, so the client can read them.
 */
export function TrainerLiveWorkoutScreen({ navigation, route }: Props) {
  const { workoutId, clientId, clientName } = route.params;
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const trainerId = user?.id ?? '';

  function resolveExerciseId(exerciseId: string): Promise<string> {
    if (!accessToken) return Promise.reject(new Error('You are signed out'));
    return resolveClientExercise(accessToken, clientId, exerciseId).then(
      (result) => result.exerciseId,
    );
  }

  // Discards the session: nothing from it is kept, and the client's stats do not count it.
  function cancel() {
    if (!accessToken) return;
    Alert.alert(
      'Discard this session?',
      'Nothing from it will be kept, and it will not count towards the client’s stats.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Discard session',
          style: 'destructive',
          onPress: () => {
            void cancelLiveWorkout(accessToken, clientId, workoutId)
              .then(() => navigation.goBack())
              .catch((err: unknown) =>
                Alert.alert('Could not discard', err instanceof Error ? err.message : 'Try again'),
              );
          },
        },
      ],
    );
  }

  function finish() {
    if (!accessToken) return;
    Alert.alert('Finish the session', 'The client’s workout is complete from here on.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Finish',
        style: 'destructive',
        onPress: () => {
          void finishLiveWorkout(accessToken, clientId, workoutId)
            .then(() => navigation.goBack())
            .catch((err: unknown) =>
              Alert.alert('Could not finish', err instanceof Error ? err.message : 'Try again'),
            );
        },
      },
    ]);
  }

  return (
    <Screen
      scrollTestID="trainer-live-scroll"
      header={
        <AppHeader
          title={`Live · ${clientName ?? 'Client'}`}
          onBack={() => navigation.goBack()}
          testID="trainer-live-header"
        />
      }
    >
      <View style={{ gap: 6 }}>
        <AppCard testID="trainer-live-editor">
          <Text style={{ ...typeScale.secondary, color: colors.textSecondary }}>
            Changes save as you make them. Finish when the session is over.
          </Text>
          <LiveWorkoutEditor
            workoutId={workoutId}
            userId={trainerId}
            resolveExerciseId={resolveExerciseId}
            testID="trainer-live"
          />
        </AppCard>

        <PrimaryButton testID="trainer-live-finish" label="Finish Session" onPress={finish} />
        <TextButton
          testID="trainer-live-cancel"
          label="Cancel Session"
          destructive
          onPress={cancel}
        />
      </View>
    </Screen>
  );
}
