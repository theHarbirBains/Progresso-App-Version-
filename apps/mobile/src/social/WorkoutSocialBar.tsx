import { Feather } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../design/Text';
import { colors, minTouchTarget, spacing, typeScale } from '../design/theme';
import type { SocialSummary } from '../lib/socialApi';

/**
 * A workout's likes and comments, under its card: a heart (the accent, once you've liked it)
 * with how many liked it, and a speech bubble with how many comments -- each a full 44pt target.
 * The heart likes or unlikes; the bubble opens the workout at its comments.
 */
export function WorkoutSocialBar({
  summary,
  onToggleLike,
  onComments,
  accentColor,
  testID,
}: {
  summary: SocialSummary;
  onToggleLike: () => void;
  onComments: () => void;
  accentColor: string;
  testID: string;
}) {
  const { likeCount, commentCount, likedByMe } = summary;
  return (
    <View testID={testID} style={styles.bar}>
      <TouchableOpacity
        testID={`${testID}-like`}
        style={styles.action}
        onPress={onToggleLike}
        accessibilityRole="button"
        accessibilityLabel={likedByMe ? 'Unlike' : 'Like'}
        accessibilityState={{ selected: likedByMe }}
        accessibilityHint={`${likeCount} ${likeCount === 1 ? 'like' : 'likes'}`}
      >
        <Feather name="heart" size={20} color={likedByMe ? accentColor : colors.textSecondary} />
        <Text
          testID={`${testID}-like-count`}
          style={[styles.count, likedByMe ? { color: accentColor } : null]}
        >
          {likeCount}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID={`${testID}-comments`}
        style={styles.action}
        onPress={onComments}
        accessibilityRole="button"
        accessibilityLabel={`${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}, open`}
      >
        <Feather name="message-circle" size={20} color={colors.textSecondary} />
        <Text testID={`${testID}-comment-count`} style={styles.count}>
          {commentCount}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
    marginLeft: -spacing.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    paddingHorizontal: spacing.sm,
  },
  count: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
});
