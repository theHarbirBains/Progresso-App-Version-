import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale } from '../design/theme';
import { claimTrainerHistory } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';

type Props = RootStackScreenProps<'TrainerClaim'>;

const CODE_PATTERN = /^[A-Za-z0-9 -]{8,12}$/;

/**
 * The client's side of a tracked history: they enter the code their trainer gave
 * them, and the workouts logged for them move onto their own account.
 */
export function TrainerClaimScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      const count = workouts === 1 ? '1 workout is' : `${workouts} workouts are`;
      Alert.alert(
        'History linked',
        `${count} now on your account. Accept your trainer’s request in Trainer Access to keep them coaching you.`,
      );
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
      <View style={styles.body}>
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
      </View>
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
