import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../design/Avatar';
import { ListRow } from '../design/ListRow';
import { Text } from '../design/Text';
import { colors, typeScale } from '../design/theme';
import {
  sendFollowRequest,
  unfollowUser,
  type FollowSearchResult,
  type FollowStatus,
} from '../lib/api';
import { FollowButton } from './FollowButton';

/** "Sam Lee" over "@sam", or "@sam" alone, or "Someone". */
export function personLabel(user: FollowSearchResult['user']): {
  title: string;
  subtitle: string | undefined;
} {
  if (user.displayName) {
    return { title: user.displayName, subtitle: user.username ? `@${user.username}` : undefined };
  }
  return { title: user.username ? `@${user.username}` : 'Someone', subtitle: undefined };
}

/**
 * People as rows -- avatar, name and @username -- each opening their profile, with its own
 * Follow / Requested / Following button (none on your own row). Following from here is kept on
 * the row; a failure says so under the list.
 */
export function PeopleList({
  people,
  selfId,
  onOpen,
  testIDPrefix,
}: {
  people: FollowSearchResult[];
  selfId: string;
  onOpen: (userId: string) => void;
  testIDPrefix: string;
}) {
  const accessToken = useAuth().session?.access_token;
  const [status, setStatus] = useState<Record<string, FollowStatus>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // A fresh list starts from what it says.
  useEffect(() => {
    setStatus(Object.fromEntries(people.map((person) => [person.user.id, person.status])));
  }, [people]);

  async function change(userId: string, follow: boolean) {
    if (!accessToken) return;
    setPending((p) => ({ ...p, [userId]: true }));
    setError(null);
    try {
      if (follow) {
        const result = await sendFollowRequest(accessToken, userId);
        setStatus((s) => ({ ...s, [userId]: result.status }));
      } else {
        await unfollowUser(accessToken, userId);
        setStatus((s) => ({ ...s, [userId]: 'none' }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.');
    } finally {
      setPending((p) => ({ ...p, [userId]: false }));
    }
  }

  return (
    <>
      {people.map((person, index) => {
        const { title, subtitle } = personLabel(person.user);
        const id = person.user.id;
        return (
          <ListRow
            key={id}
            testID={`${testIDPrefix}-${id}`}
            divider={index > 0}
            onPress={() => onOpen(id)}
            accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}, open profile`}
            leading={
              <Avatar
                uri={person.user.avatarUrl}
                initial={title.charAt(0).toUpperCase()}
                size={40}
                iconSize={18}
                iconColor={colors.textSecondary}
              />
            }
            title={id === selfId ? `${title} (you)` : title}
            subtitle={subtitle}
            trailing={
              id === selfId ? undefined : (
                <FollowButton
                  testID={`${testIDPrefix}-${id}`}
                  status={status[id] ?? person.status}
                  loading={Boolean(pending[id])}
                  onFollow={() => void change(id, true)}
                  onUnfollow={() => void change(id, false)}
                />
              )
            }
          />
        );
      })}
      {error ? (
        <Text testID={`${testIDPrefix}-error`} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  error: {
    ...typeScale.callout,
    color: colors.destructive,
  },
});
