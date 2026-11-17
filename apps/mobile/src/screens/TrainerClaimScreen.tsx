import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import { Card } from '../design/Card';
import { claimTrainerHistory } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useAchievements } from '../achievements/achievementsContext';
import { invalidateExerciseCache } from '../exercises/exerciseQueries';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';

type Props = RootStackScreenProps<'TrainerClaim'>;

const CODE_PATTERN = /^[A-Za-z0-9 -]{8,12}$/;

/**
 * The client's side of a tracked history: they enter the code their trainer gave
 * them, and the workouts logged for them move onto their own account -- their
 * trainer stays linked. The history, records and exercises read once per sign-in
 * are read again, so Progress and the profile show the claimed workouts at once.
 */
export function TrainerClaimScreen({ navigation }: Props) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const { refetch: refetchAllTimeStats } = useAllTimeStats();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { evaluate } = useAchievements();

  async function handleClaim() {
    if (!accessToken || saving) return;
    const entered = code.trim();
    if (!CODE_PATTERN.test(entered)) {
      setError('Enter the 8-character code your trainer gave you');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { workouts } = await claimTrainerHistory(accessToken, entered);
      // The claimed workouts, records and custom exercises are theirs now.
      void refetchAllTimeStats();
      if (user?.id) invalidateExerciseCache(user.id);
      // The claimed history counts toward their achievements: show what it's earned.
      void evaluate();
      const count = workouts === 1 ? '1 workout is' : `${workouts} workouts are`;
      Alert.alert('History linked', `${count} now on your account.`);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link this history');
      setSaving(false);
    }
  }

  return (
    <Screen
      scrollTestID="trainer-claim-scroll"
      keyboardAvoiding
      header={
        <AppHeader
          title="Link Tracked History"
          onBack={() => navigation.goBack()}
          testID="trainer-claim-header"
        />
      }
    >
      <Card style={styles.body}>
        <Text style={styles.note}>
          If a trainer tracked you before you had a Progresso account, they can give you a code.
          Enter it here to move that history onto your account.
        </Text>

        <TextInput
          testID="trainer-claim-code-input"
          label="Claim code"
          value={code}
          onChangeText={(text) => setCode(text)}
          autoCapitalize="characters"
          placeholder="ABCD-EFGH"
          error={error ?? undefined}
        />

        <PrimaryButton
          testID="trainer-claim-submit"
          label="Link History"
          onPress={() => void handleClaim()}
          loading={saving}
          disabled={saving}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
});
