import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { FollowStatus } from '../follows/follows.service';
import { isBlockedEitherWay, loadBlocks } from '../safety/blocks';
import type { SupabaseService } from '../supabase/supabase.service';

type Client = ReturnType<SupabaseService['getClient']>;

/** How the signed-in person (the viewer) stands with someone else. */
export interface Relationship {
  isSelf: boolean;
  /** The viewer's follow of them. */
  followStatus: FollowStatus;
  /** Their accepted follow of the viewer. */
  followsYou: boolean;
  /** Their request to follow the viewer, waiting for an answer. */
  requestId: string | null;
}

/**
 * How the viewer stands with this person. Someone blocked either way is no one at all here --
 * the same "User not found" a search for them gives -- so a block is never revealed.
 * viewerId is the signed-in user's own id (it goes into a filter string, as in loadBlocks).
 */
export async function relationshipWith(
  client: Client,
  viewerId: string,
  personId: string,
): Promise<Relationship> {
  if (viewerId === personId) {
    return { isSelf: true, followStatus: 'none', followsYou: false, requestId: null };
  }
  const [blocks, follows] = await Promise.all([
    loadBlocks(client, viewerId),
    client
      .from('follows')
      .select('id, follower_id, followee_id, status')
      .or(
        `and(follower_id.eq.${viewerId},followee_id.eq.${personId}),and(follower_id.eq.${personId},followee_id.eq.${viewerId})`,
      ),
  ]);
  if (isBlockedEitherWay(blocks, personId)) throw new NotFoundException('User not found');
  if (follows.error) throw new InternalServerErrorException('Failed to load follow state');
  const rows = (follows.data ?? []) as {
    id: string;
    follower_id: string;
    followee_id: string;
    status: 'pending' | 'accepted';
  }[];
  const mine = rows.find((row) => row.follower_id === viewerId);
  const theirs = rows.find((row) => row.follower_id === personId);
  return {
    isSelf: false,
    followStatus: mine?.status ?? 'none',
    followsYou: theirs?.status === 'accepted',
    requestId: theirs?.status === 'pending' ? theirs.id : null,
  };
}

/**
 * Whether the viewer can see this person's activity -- their workouts, stats, lifts, likes and
 * comments, and who follows them: it's the viewer's own, or the viewer follows them and they
 * accepted.
 */
export function canSeeActivity(relationship: Relationship): boolean {
  return relationship.isSelf || relationship.followStatus === 'accepted';
}
