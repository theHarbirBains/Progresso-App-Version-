import { useState } from 'react';
import { AppHeader } from '../design/AppHeader';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { Text } from '../design/Text';
import type { MembershipTier } from '../lib/api';
import { MembershipCards } from '../membership/MembershipCards';
import { useMembership } from '../membership/useMembership';
import type { RootStackScreenProps } from '../navigation/types';
import { useProfile } from '../profile/ProfileProvider';
import { settingsStyles as styles } from '../settings/settingsStyles';

type Props = RootStackScreenProps<'SettingsMembership'>;

/**
 * Settings > Membership: which parts of Progresso the person uses -- Workouts, Workouts +
 * Nutrition, or Everything (with Trainer Mode). All free for now; a tap switches at once, and
 * nothing logged is ever lost by switching -- a part left out is only locked until it's back.
 */
export function SettingsMembershipScreen({ navigation }: Props) {
  const { updateProfile } = useProfile();
  const { tier } = useMembership();
  const [saving, setSaving] = useState<MembershipTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(next: MembershipTier) {
    if (next === tier || saving) return;
    setSaving(next);
    setError(null);
    try {
      await updateProfile({ membershipTier: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change membership');
    } finally {
      setSaving(null);
    }
  }

  return (
    <Screen
      testID="settings-membership-screen"
      scrollTestID="settings-membership-scroll"
      contentContainerStyle={styles.categoryGap}
      header={
        <AppHeader
          testID="settings-membership-header"
          title="Membership"
          subtitle="Free for now. Switch any time."
          onBack={() => navigation.goBack()}
        />
      }
    >
      <Section title="Your Membership">
        <Text style={styles.intro}>
          Pick what you use Progresso for. Switching never deletes anything you&apos;ve logged.
        </Text>
        {error ? (
          <Text testID="settings-membership-error" style={styles.errorText}>
            {error}
          </Text>
        ) : null}
        <MembershipCards
          testID="settings-membership"
          value={tier}
          saving={saving}
          onChoose={(next) => void choose(next)}
        />
      </Section>
    </Screen>
  );
}
