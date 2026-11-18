import { Alert } from 'react-native';

/** "Sam" from "Sam Lee", else their @username, else "them". */
export function unfollowName(user: {
  displayName?: string | null;
  username?: string | null;
}): string {
  const name = user.displayName?.trim();
  if (name) return name.split(/\s+/)[0] ?? name;
  return user.username ? `@${user.username}` : 'them';
}

/**
 * Asks before unfollowing someone you follow -- every Following button does (a profile, Find
 * People, follower and following lists). A request they haven't accepted yet is cancelled
 * without asking.
 */
export function confirmUnfollow(name: string, unfollow: () => void): void {
  Alert.alert(`Unfollow ${name}?`, "You won't see their workouts any more.", [
    { text: 'Keep Following', style: 'cancel' },
    { text: 'Unfollow', style: 'destructive', onPress: unfollow },
  ]);
}
