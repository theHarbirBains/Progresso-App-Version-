import { Share } from 'react-native';

/**
 * Shares a profile through the system share sheet: "Follow me on Progresso: @sam" for your own,
 * "Check out Sam Lee on Progresso (@sam)." for someone else's. Dismissing the sheet is no error.
 */
export function shareProfile(target: { isSelf: boolean; username: string | null }, name: string) {
  const handle = target.username ? `@${target.username}` : null;
  const message = target.isSelf
    ? `Follow me on Progresso${handle ? `: ${handle}` : '.'}`
    : `Check out ${name} on Progresso${handle ? ` (${handle})` : ''}.`;
  void Share.share({ message }).catch(() => undefined);
}
