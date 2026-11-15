import { useCallback, useEffect, useState } from 'react';
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
import { phoneCountry } from '../lib/phoneNumbers';
import { useProfile } from '../profile/ProfileProvider';
import { contactHashes } from './contactHashes';
import { PeopleList } from './PeopleList';

type Step =
  | { kind: 'searching' }
  | { kind: 'ask' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }
  | { kind: 'found'; people: FollowSearchResult[] };

/**
 * Find People's Suggested tab: the people in your phone's contacts who are on Progresso and
 * whom you don't follow yet, found by their email or phone number, each to follow from here.
 * Once Progresso may see the contacts they're read each time the tab opens; until then nothing
 * is read until you tap Find Friends, which asks. The addresses and numbers are scrambled on the
 * phone (contactHashes.ts) and only that is sent, and nothing sent is kept.
 */
export function ContactSuggestions({ onOpen }: { onOpen: (userId: string) => void }) {
  const { user, session } = useAuth();
  const accessToken = session?.access_token;
  const country = phoneCountry(useProfile().profile?.country);
  const [step, setStep] = useState<Step>({ kind: 'searching' });

  const find = useCallback(
    async (ask: boolean) => {
      if (!accessToken) return;
      setStep({ kind: 'searching' });
      try {
        const { access, emailHashes, phoneHashes } = await contactHashes(country, { ask });
        if (access !== 'granted') {
          setStep({ kind: access === 'denied' ? 'denied' : 'ask' });
          return;
        }
        const people =
          emailHashes.length > 0 || phoneHashes.length > 0
            ? await matchContacts(accessToken, emailHashes, phoneHashes)
            : [];
        // Suggestions: only the people you don't follow yet.
        setStep({ kind: 'found', people: people.filter((person) => person.status !== 'accepted') });
      } catch (err) {
        setStep({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Could not look through your contacts',
        });
      }
    },
    [accessToken, country],
  );

  // Read as the tab opens -- asking nothing.
  useEffect(() => {
    void find(false);
  }, [find]);

  if (step.kind === 'searching') {
    return <SkeletonRows testID="contact-suggestions-loading" count={4} />;
  }
  if (step.kind === 'error') {
    return (
      <ErrorState
        testID="contact-suggestions-error"
        message={step.message}
        onRetry={() => void find(false)}
      />
    );
  }
  if (step.kind === 'denied') {
    return (
      <AppCard testID="contact-suggestions-denied">
        <View style={styles.body}>
          <Text style={styles.title}>Progresso can&apos;t see your contacts</Text>
          <Text style={styles.text}>
            To see which of your contacts are on Progresso, allow Contacts for Progresso in your
            iPhone&apos;s Settings.
          </Text>
          <SecondaryButton
            testID="contact-suggestions-settings"
            label="Open iPhone Settings"
            onPress={() => void Linking.openSettings()}
          />
        </View>
      </AppCard>
    );
  }
  if (step.kind === 'ask') {
    return (
      <AppCard testID="contact-suggestions-ask">
        <View style={styles.body}>
          <Text style={styles.title}>Find friends from your contacts</Text>
          <Text style={styles.text}>
            See which of your contacts are on Progresso, by their email or phone number.
            They&apos;re scrambled on your phone before anything is sent, and nothing is kept.
          </Text>
          <PrimaryButton
            testID="contact-suggestions-find"
            label="Find Friends"
            onPress={() => void find(true)}
          />
        </View>
      </AppCard>
    );
  }
  return step.people.length === 0 ? (
    <EmptyState
      testID="contact-suggestions-none"
      title="No suggestions right now"
      description="When people in your contacts join Progresso, they show up here. Invite them below."
    />
  ) : (
    <AppCard testID="contact-suggestions-found">
      <SectionHeader
        label={`${step.people.length} ${step.people.length === 1 ? 'contact' : 'contacts'} on Progresso`}
      />
      <PeopleList
        people={step.people}
        selfId={user?.id ?? ''}
        onOpen={onOpen}
        testIDPrefix="contact-suggestions-person"
      />
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
