import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { colors, spacing, typeScale } from '../design/theme';
import { matchContacts, type FollowSearchResult } from '../lib/api';
import { contactEmailHashes } from './contactEmails';
import { PeopleList } from './PeopleList';

type Step =
  | { kind: 'start' }
  | { kind: 'searching' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }
  | { kind: 'found'; people: FollowSearchResult[] };

/**
 * Find People's Contacts tab: the people in your phone's contacts who are on Progresso, found by
 * email. Nothing is read until you tap Find Friends; the addresses are scrambled on the phone
 * (contactEmails.ts) and only that is sent, and nothing sent is kept. Each person found opens
 * their profile and can be followed from here.
 */
export function ContactsFinder({ onOpen }: { onOpen: (userId: string) => void }) {
  const { user, session } = useAuth();
  const accessToken = session?.access_token;
  const [step, setStep] = useState<Step>({ kind: 'start' });

  async function find() {
    if (!accessToken) return;
    setStep({ kind: 'searching' });
    try {
      const { access, hashes } = await contactEmailHashes();
      if (access === 'denied') {
        setStep({ kind: 'denied' });
        return;
      }
      const people = hashes.length > 0 ? await matchContacts(accessToken, hashes) : [];
      setStep({ kind: 'found', people });
    } catch (err) {
      setStep({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not look through your contacts',
      });
    }
  }

  if (step.kind === 'searching') {
    return <SkeletonRows testID="contacts-finder-loading" count={4} />;
  }
  if (step.kind === 'error') {
    return (
      <ErrorState
        testID="contacts-finder-error"
        message={step.message}
        onRetry={() => void find()}
      />
    );
  }
  if (step.kind === 'denied') {
    return (
      <AppCard testID="contacts-finder-denied">
        <View style={styles.body}>
          <Text style={styles.title}>Progresso can&apos;t see your contacts</Text>
          <Text style={styles.text}>
            To find friends this way, allow Contacts for Progresso in your iPhone&apos;s Settings.
          </Text>
          <SecondaryButton
            testID="contacts-finder-settings"
            label="Open iPhone Settings"
            onPress={() => void Linking.openSettings()}
          />
        </View>
      </AppCard>
    );
  }
  if (step.kind === 'found') {
    return step.people.length === 0 ? (
      <EmptyState
        testID="contacts-finder-none"
        title="None of your contacts are on Progresso yet"
        description="Invite them below. Once they join, they show up here."
      />
    ) : (
      <AppCard testID="contacts-finder-found">
        <SectionHeader
          label={`${step.people.length} ${step.people.length === 1 ? 'contact' : 'contacts'} on Progresso`}
        />
        <PeopleList
          people={step.people}
          selfId={user?.id ?? ''}
          onOpen={onOpen}
          testIDPrefix="contacts-finder-person"
        />
      </AppCard>
    );
  }
  return (
    <AppCard testID="contacts-finder-start">
      <View style={styles.body}>
        <Text style={styles.title}>Find friends from your contacts</Text>
        <Text style={styles.text}>
          See which of your contacts are on Progresso, by their email. The addresses are scrambled
          on your phone before anything is sent, and nothing is kept.
        </Text>
        <PrimaryButton
          testID="contacts-finder-find"
          label="Find Friends"
          onPress={() => void find()}
        />
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
  },
  title: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  text: {
    ...typeScale.secondary,
    color: colors.textSecondary,
  },
});
