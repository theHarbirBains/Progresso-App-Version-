import { StyleSheet } from 'react-native';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { Screen } from '../design/Screen';
import { SectionHeader } from '../design/SectionHeader';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import type { RootStackScreenProps } from '../navigation/types';

type Props = RootStackScreenProps<'TrainerClaimCode'>;

/**
 * The one-time claim code for a client the trainer tracks. It is shown here and
 * nowhere else, so the trainer copies or notes it before leaving this screen.
 */
export function TrainerClaimCodeScreen({ navigation, route }: Props) {
  const { code, clientName } = route.params;

  return (
    <Screen
      scrollTestID="trainer-claim-code-scroll"
      header={
        <AppHeader
          title="Claim Code"
          onBack={() => navigation.navigate('TrainerClients')}
          testID="trainer-claim-code-header"
        />
      }
    >
      <AppCard testID="trainer-claim-code-card">
        <SectionHeader label={clientName ? `For ${clientName}` : 'Client code'} />
        <Text
          testID="trainer-claim-code"
          style={styles.code}
          accessibilityLabel={`Claim code ${code}`}
        >
          {code}
        </Text>
        <Text style={styles.note}>
          Give this code to them. In Progresso they open Trainer Access, choose Link Tracked History
          and enter it. Their workouts with you then move onto their own account. The code works
          once and for 30 days. Getting a new code replaces this one.
        </Text>
      </AppCard>

      <PrimaryButton
        testID="trainer-claim-code-done"
        label="Done"
        onPress={() => navigation.navigate('TrainerClients')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: {
    ...typeScale.statLarge,
    color: colors.textPrimary,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  note: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
});
