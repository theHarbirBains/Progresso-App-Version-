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
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import { matchContacts, type FollowSearchResult, type FollowStatus } from '../lib/api';
import { phoneCountry } from '../lib/phoneNumbers';
import { useProfile } from '../profile/ProfileProvider';
import { contactHashes } from './contactHashes';
import { PeopleList } from './PeopleList';

type Step =
  | { kind: 'searching' }
  | { kind: 'ask' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }
  | { kind: 'found'; people: FollowSearchResult[]; limited: boolean };

/** Who to follow first: those you don't follow yet, then those asked, then those followed. */
const STATUS_ORDER: Record<FollowStatus, number> = { none: 0, pending: 1, accepted: 2 };

/**
 * Find People's Suggested tab (and the welcome's friends step): everyone in your phone's
 * contacts who's on Progresso, found by their email or phone number, each to follow from here
 * -- those you don't follow yet first. Once Progresso may see the contacts they're read each time
 * the tab opens; until then nothing is read until you tap Allow Contacts, which asks. If iPhone
 * was told to show Progresso only some contacts, it says how to allow them all. The addresses and
 * numbers are scrambled on the phone (contactHashes.ts) and only that is sent, and nothing sent
 * is kept.
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
        const { access, limited, emailHashes, phoneHashes } = await contactHashes(country, {
          ask,
        });
        if (access !== 'granted') {
          setStep({ kind: access === 'denied' ? 'denied' : 'ask' });
          return;
        }
        const people =
          emailHashes.length > 0 || phoneHashes.length > 0
            ? await matchContacts(accessToken, emailHashes, phoneHashes)
            : [];
        setStep({
          kind: 'found',
          people: [...people].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
          limited,
        });
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
          <Text style={styles.title}>Find your friends</Text>
          <Text style={styles.text}>
            Allow Progresso to see your contacts, and everyone in them on Progresso shows up here to
            follow. Nothing from your contacts is kept.
          </Text>
          <PrimaryButton
            testID="contact-suggestions-find"
            label="Allow Contacts"
            onPress={() => void find(true)}
          />
        </View>
      </AppCard>
    );
  }
  return (
    <View style={styles.found}>
      {step.limited ? (
        <AppCard testID="contact-suggestions-limited">
          <View style={styles.body}>
            <Text style={styles.text}>
              Progresso can only see the contacts you picked. To find everyone, choose Full Access
              under Contacts in your iPhone&apos;s Settings.
            </Text>
            <SecondaryButton
              testID="contact-suggestions-limited-settings"
              label="Open iPhone Settings"
              onPress={() => void Linking.openSettings()}
            />
          </View>
        </AppCard>
      ) : null}
      {step.people.length === 0 ? (
        <EmptyState
          testID="contact-suggestions-none"
          title="None of your contacts are on Progresso yet"
          description="When they join, they show up here."
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  found: {
    gap: widgetGap,
  },
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
