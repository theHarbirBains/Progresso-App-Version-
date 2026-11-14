import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { Avatar } from '../design/Avatar';
import { BottomSheet } from '../design/BottomSheet';
import { PrimaryButton } from '../design/Button';
import { ErrorState } from '../design/ErrorState';
import { IconButton } from '../design/IconButton';
import { ListRow } from '../design/ListRow';
import { SectionHeader } from '../design/SectionHeader';
import { SkeletonRows } from '../design/Skeleton';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, minTouchTarget, spacing, typeScale } from '../design/theme';
import type { FollowUser } from '../lib/followsApi';
import {
  deleteComment,
  getWorkoutSocial,
  likeWorkout,
  postComment,
  unlikeWorkout,
  type WorkoutComment,
  type WorkoutSocial,
} from '../lib/api';
import { formatCardDate } from '../workouts/workoutFormat';
import { personLabel } from './PeopleList';
import { PersonActionsSheet } from './PersonActionsSheet';

/** The longest comment (the database's own limit). */
export const COMMENT_MAX = 500;

/** "Liked by Sam", "Liked by Sam and Jo", "Liked by Sam and 3 others". */
export function likedByLine(likers: FollowUser[], likeCount: number): string | null {
  if (likeCount === 0 || likers.length === 0) return null;
  const first = personLabel(likers[0]!).title;
  if (likeCount === 1) return `Liked by ${first}`;
  if (likeCount === 2 && likers[1]) return `Liked by ${first} and ${personLabel(likers[1]).title}`;
  return `Liked by ${first} and ${likeCount - 1} others`;
}

/**
 * A finished workout's likes and comments, on its own page: a heart to like it (the accent once
 * you have) with who liked it -- tap for everyone -- then the comments, oldest first, each with
 * its writer (opening their profile), when, and a "..." to delete it (yours, or any on your
 * workout) or report it (someone else's), and a box to add one. Read when the page opens and
 * after each change; nothing from someone blocked either way shows.
 */
export function WorkoutComments({
  workoutId,
  accentColor,
  onAccentColor,
  onOpenPerson,
  testID = 'workout-comments',
}: {
  workoutId: string;
  accentColor: string;
  onAccentColor: string;
  onOpenPerson: (userId: string) => void;
  testID?: string;
}) {
  const { user, session } = useAuth();
  const me = user?.id ?? '';
  const accessToken = session?.access_token;
  const [social, setSocial] = useState<WorkoutSocial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [likersOpen, setLikersOpen] = useState(false);
  const [reporting, setReporting] = useState<WorkoutComment | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setSocial(await getWorkoutSocial(accessToken, workoutId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load likes and comments');
    }
  }, [accessToken, workoutId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleLike() {
    if (!accessToken || !social) return;
    const liking = !social.likedByMe;
    // Shown at once; put back if it doesn't save.
    setSocial({
      ...social,
      likedByMe: liking,
      likeCount: social.likeCount + (liking ? 1 : -1),
    });
    try {
      if (liking) await likeWorkout(accessToken, workoutId);
      else await unlikeWorkout(accessToken, workoutId);
      await load();
    } catch {
      setSocial(social);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!accessToken || !body || sending) return;
    setSending(true);
    try {
      await postComment(accessToken, workoutId, body);
      setDraft('');
      await load();
    } catch (err) {
      Alert.alert('Comment not posted', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  function commentActions(comment: WorkoutComment) {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (comment.canDelete) {
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!accessToken) return;
          deleteComment(accessToken, comment.id)
            .then(load)
            .catch((err: unknown) =>
              Alert.alert(
                'Comment not deleted',
                err instanceof Error ? err.message : 'Please try again.',
              ),
            );
        },
      });
    }
    if (comment.user.id !== me) {
      buttons.push({ text: 'Report', onPress: () => setReporting(comment) });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Comment', undefined, buttons);
  }

  if (error && !social) {
    return <ErrorState testID={`${testID}-error`} message={error} onRetry={() => void load()} />;
  }
  if (!social) return <SkeletonRows testID={`${testID}-loading`} count={2} />;

  const likedBy = likedByLine(social.likers, social.likeCount);

  return (
    <AppCard testID={testID}>
      <View style={styles.likeRow}>
        <TouchableOpacity
          testID={`${testID}-like`}
          style={styles.likeButton}
          onPress={() => void toggleLike()}
          accessibilityRole="button"
          accessibilityLabel={social.likedByMe ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: social.likedByMe }}
        >
          <Feather
            name="heart"
            size={22}
            color={social.likedByMe ? accentColor : colors.textSecondary}
          />
        </TouchableOpacity>
        {likedBy ? (
          <TouchableOpacity
            testID={`${testID}-liked-by`}
            style={styles.likedBy}
            onPress={() => setLikersOpen(true)}
            accessibilityRole="button"
            accessibilityHint="Shows everyone who liked it"
          >
            <Text style={styles.likedByText} numberOfLines={1}>
              {likedBy}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.muted}>Be the first to like it</Text>
        )}
      </View>

      <SectionHeader
        label={
          social.comments.length > 0
            ? `${social.comments.length} ${social.comments.length === 1 ? 'Comment' : 'Comments'}`
            : 'Comments'
        }
      />
      {social.comments.length === 0 ? (
        <Text testID={`${testID}-none`} style={styles.muted}>
          No comments yet.
        </Text>
      ) : (
        social.comments.map((comment, index) => {
          const { title } = personLabel(comment.user);
          return (
            <View
              key={comment.id}
              testID={`${testID}-comment-${comment.id}`}
              style={[styles.comment, index > 0 && styles.commentDivider]}
            >
              <TouchableOpacity
                onPress={() => onOpenPerson(comment.user.id)}
                accessibilityRole="button"
                accessibilityLabel={`${title}, open profile`}
              >
                <Avatar
                  uri={comment.user.avatarUrl}
                  initial={title.charAt(0).toUpperCase()}
                  size={32}
                  iconSize={16}
                  iconColor={colors.textSecondary}
                />
              </TouchableOpacity>
              <View style={styles.commentBody}>
                <Text style={styles.commentMeta} numberOfLines={1}>
                  <Text style={styles.commentName}>{title}</Text>
                  {`  ${formatCardDate(comment.createdAt)}`}
                </Text>
                <Text testID={`${testID}-comment-${comment.id}-body`} style={styles.commentText}>
                  {comment.body}
                </Text>
              </View>
              {comment.canDelete || comment.user.id !== me ? (
                <IconButton
                  testID={`${testID}-comment-${comment.id}-more`}
                  icon="more-horizontal"
                  onPress={() => commentActions(comment)}
                  accessibilityLabel={`More options for ${title}'s comment`}
                  color={colors.textMuted}
                />
              ) : null}
            </View>
          );
        })
      )}

      <View style={styles.composer}>
        <View style={styles.composerInput}>
          <TextInput
            testID={`${testID}-input`}
            placeholder="Add a comment"
            accessibilityLabel="Add a comment"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={COMMENT_MAX}
          />
        </View>
        <PrimaryButton
          testID={`${testID}-send`}
          label="Post"
          size="sm"
          loading={sending}
          disabled={draft.trim().length === 0}
          onPress={() => void send()}
          accentColor={accentColor}
          onAccentColor={onAccentColor}
        />
      </View>

      <BottomSheet
        visible={likersOpen}
        onClose={() => setLikersOpen(false)}
        testID={`${testID}-likers`}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Likes</Text>
          {social.likers.map((liker, index) => {
            const { title, subtitle } = personLabel(liker);
            return (
              <ListRow
                key={liker.id}
                testID={`${testID}-liker-${liker.id}`}
                divider={index > 0}
                leading={
                  <Avatar
                    uri={liker.avatarUrl}
                    initial={title.charAt(0).toUpperCase()}
                    size={36}
                    iconSize={16}
                    iconColor={colors.textSecondary}
                  />
                }
                title={title}
                subtitle={subtitle}
                onPress={() => {
                  setLikersOpen(false);
                  onOpenPerson(liker.id);
                }}
              />
            );
          })}
        </View>
      </BottomSheet>

      <PersonActionsSheet
        person={reporting?.user ?? null}
        commentId={reporting?.id}
        onClose={() => setReporting(null)}
        onBlocked={() => {
          setReporting(null);
          void load();
        }}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  likeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  likeButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.md,
  },
  likedBy: {
    flex: 1,
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  likedByText: {
    ...typeScale.callout,
    color: colors.textPrimary,
  },
  muted: {
    ...typeScale.secondary,
    color: colors.textMuted,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  commentDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  commentBody: {
    flex: 1,
    gap: 2,
  },
  commentMeta: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  commentName: {
    ...typeScale.caption,
    color: colors.textPrimary,
  },
  commentText: {
    ...typeScale.body,
    color: colors.textPrimary,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  composerInput: {
    flex: 1,
  },
  sheet: {
    gap: spacing.sm,
    padding: spacing.lg,
  },
  sheetTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
});
