import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';

type Client = ReturnType<SupabaseService['getClient']>;

/** Who this user has blocked, and who has blocked them. */
export interface BlockState {
  blocked: Set<string>;
  blockedBy: Set<string>;
}

/**
 * This user's blocks, both ways, in one read. userId must be the signed-in user's own id
 * (from the verified token): it goes into a filter string, which an id from a request
 * could break.
 */
export async function loadBlocks(client: Client, userId: string): Promise<BlockState> {
  const { data, error } = await client
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  if (error) throw new InternalServerErrorException('Failed to check blocked people');
  const state: BlockState = { blocked: new Set(), blockedBy: new Set() };
  for (const row of (data ?? []) as { blocker_id: string; blocked_id: string }[]) {
    if (row.blocker_id === userId) state.blocked.add(row.blocked_id);
    else state.blockedBy.add(row.blocker_id);
  }
  return state;
}

/** Whether either of them has blocked the other. */
export function isBlockedEitherWay(state: BlockState, otherId: string): boolean {
  return state.blocked.has(otherId) || state.blockedBy.has(otherId);
}
