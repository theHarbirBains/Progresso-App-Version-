import { Alert, ScrollView, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton, TextButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { useProgressTheme } from '../progress/useProgressTheme';
import { cancelLiveWorkout, finishLiveWorkout, resolveClientExercise } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { GroupWorkoutEditor } from '../workouts/GroupWorkoutEditor';
import { liveWorkoutStyles as styles } from './liveWorkoutStyles';

type Props = RootStackScreenProps<'TrainerLiveWorkout'>;

/**
 * A live session the trainer runs for a client, laid out like the client\'s own live
 * workout: the same header, stats, exercise cards and footer, with only the client in it.
 * Changes save as they are made, and the session stays open until the trainer finishes
 * it. Exercises the trainer picks (including their own custom ones) are resolved to the
 * client\'s copies, so the client can read them.
 */
export function TrainerLiveWorkoutScreen({ navigation, route }: Props) {
  const { workoutId, clientId, clientName, startedAt } = route.params;
  const { session, user } = useAuth();
  const { theme } = useProgressTheme();
  const accessToken = session?.access_token;
  const trainerId = user?.id ?? '';
  const title = clientName ?? 'Client';

  function resolveExerciseId(exerciseId: string): Promise<string> {
    if (!accessToken) return Promise.reject(new Error('You are signed out'));
    return resolveClientExercise(accessToken, clientId, exerciseId).then(
      (result) => result.exerciseId,
    );
  }

  // Discards the session: nothing from it is kept, and the client\'s stats do not count it.
  function cancel() {
    if (!accessToken) return;
    Alert.alert(
      'Discard this session?',
      "Nothing from it will be kept, and it will not count towards the client's stats.",
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
    Alert.alert('Finish the session', "The client's workout is complete from here on.", [
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
      scroll={false}
      padded={false}
      keyboardAvoiding
      header={
        <AppHeader
          title={title}
          subtitle="Live session"
          onBack={() => navigation.goBack()}
          testID="trainer-live-header"
        />
      }
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <GroupWorkoutEditor
          members={[{ userId: clientId, displayName: title, workoutId }]}
          startedAt={startedAt ?? new Date().toISOString()}
          userId={trainerId}
          resolveExerciseId={resolveExerciseId}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
          testID="trainer-live"
        />

        <View style={styles.endActions}>
          <TextButton
            testID="trainer-live-cancel"
            label="Cancel Session"
            destructive
            onPress={cancel}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          testID="trainer-live-finish"
          label="Finish Session"
          onPress={finish}
          accentColor={theme.accent}
          onAccentColor={theme.onAccent}
        />
      </View>
    </Screen>
  );
}
