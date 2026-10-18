import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppHeader } from '../design/AppHeader';
import { Avatar } from '../design/Avatar';
import { SecondaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { Screen } from '../design/Screen';
import { Section } from '../design/Section';
import { colors } from '../design/theme';
import { listBlockedUsers, unblockUser, type FollowUser } from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { settingsStyles as styles } from '../settings/settingsStyles';
import { personName } from '../social/PersonActionsSheet';

type Props = RootStackScreenProps<'SettingsBlockedPeople'>;

/**
 * The people you've blocked (from Find People or the Friends feed), each with Unblock.
 * Unblocking doesn't restore anything a block removed: following each other starts over.
 */
export function SettingsBlockedPeopleScreen({ navigation }: Props) {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [blocked, setBlocked] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      setBlocked(await listBlockedUsers(accessToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load blocked people');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUnblock(userId: string) {
    if (!accessToken) return;
    setUnblocking((prev) => ({ ...prev, [userId]: true }));
    try {
      await unblockUser(accessToken, userId);
      setBlocked((prev) => prev.filter((person) => person.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unblock this person');
    } finally {
      setUnblocking((prev) => ({ ...prev, [userId]: false }));
    }
  }

  return (
    <Screen
      testID="settings-blocked-people-screen"
      scrollTestID="settings-blocked-people-scroll"
      contentContainerStyle={styles.categoryGap}
      header={
        <AppHeader
          testID="settings-blocked-people-header"
          title="Blocked People"
          onBack={() => navigation.goBack()}
        />
      }
    >
      {loading ? (
        <View testID="blocked-people-loading">
          <ActivityIndicator size="large" color={colors.textPrimary} />
        </View>
      ) : error && blocked.length === 0 ? (
        <ErrorState testID="blocked-people-error" message={error} onRetry={load} />
      ) : blocked.length === 0 ? (
        <EmptyState
          testID="blocked-people-empty"
          title="You haven't blocked anyone"
          description="People you block can't find you, follow you or invite you to a group."
        />
      ) : (
        <Section title="Blocked">
          {blocked.map((person, index) => {
            const name = personName(person);
            return (
              <ListRow
                key={person.id}
                testID={`blocked-person-${person.id}`}
                divider={index > 0}
                leading={
                  <Avatar
                    uri={person.avatarUrl}
                    initial={name.replace('@', '').charAt(0).toUpperCase()}
                    size={40}
                    iconSize={18}
                    iconColor={colors.textSecondary}
                  />
                }
                title={name}
                subtitle={person.displayName && person.username ? `@${person.username}` : undefined}
                trailing={
                  <SecondaryButton
                    testID={`blocked-person-${person.id}-unblock`}
                    label="Unblock"
                    size="sm"
                    accessibilityLabel={`Unblock ${name}`}
                    loading={Boolean(unblocking[person.id])}
                    onPress={() => void handleUnblock(person.id)}
                  />
                }
              />
            );
          })}
        </Section>
      )}
    </Screen>
  );
}
