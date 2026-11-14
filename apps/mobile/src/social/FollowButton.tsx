import { PrimaryButton, SecondaryButton } from '../design/Button';
import type { FollowStatus } from '../lib/followsApi';

/**
 * Follow, Requested or Following, by where you stand with someone -- the same small buttons Find
 * People always used. Follow sends a request; Requested cancels it; Following unfollows.
 */
export function FollowButton({
  status,
  loading,
  onFollow,
  onUnfollow,
  testID,
  size = 'sm',
}: {
  status: FollowStatus;
  loading?: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  testID: string;
  size?: 'sm' | 'md';
}) {
  if (status === 'accepted') {
    return (
      <SecondaryButton
        testID={`${testID}-following`}
        label="Following"
        size={size}
        loading={loading}
        onPress={onUnfollow}
      />
    );
  }
  if (status === 'pending') {
    return (
      <SecondaryButton
        testID={`${testID}-requested`}
        label="Requested"
        size={size}
        loading={loading}
        onPress={onUnfollow}
      />
    );
  }
  return (
    <PrimaryButton
      testID={`${testID}-follow`}
      label="Follow"
      size={size}
      loading={loading}
      onPress={onFollow}
    />
  );
}
