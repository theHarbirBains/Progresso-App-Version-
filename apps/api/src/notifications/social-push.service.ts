import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ExpoPushProvider } from './providers/expo-push.provider';

/** Which of a person's Social Notifications switches a push falls under. */
export type SocialPushKind = 'follows' | 'likes' | 'comments';

const SWITCH_COLUMN: Record<SocialPushKind, string> = {
  follows: 'notify_follows',
  likes: 'notify_likes',
  comments: 'notify_comments',
};

/** The app's own links (app.json's scheme): a tapped push opens this screen. */
const APP_LINK_PREFIX = 'progresso://';

export interface SocialPush {
  title: string;
  body: string;
  /** The screen a tap opens, as the app's links have it ("notifications", "people/<id>"). */
  path: string;
}

/**
 * Push notifications for social activity -- a follow request, a request accepted, a like, a
 * comment -- sent through Expo the moment it happens. Only to someone who said yes to
 * notifications, has a device registered and has that kind switched on (Settings >
 * Notifications > Social); never for someone's own activity. Sending never fails what caused
 * it: a problem is logged, and the like or comment stands.
 */
@Injectable()
export class SocialPushService {
  private readonly logger = new Logger(SocialPushService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly expoPush: ExpoPushProvider,
  ) {}

  /** How a person is named in a push: their name, else @username, else "Someone". */
  async nameOf(userId: string): Promise<string> {
    const { data } = await this.supabaseService
      .getClient()
      .from('users')
      .select('display_name, username')
      .eq('id', userId)
      .maybeSingle();
    const row = data as { display_name: string | null; username: string | null } | null;
    return row?.display_name ?? (row?.username ? `@${row.username}` : 'Someone');
  }

  async notify(userId: string, kind: SocialPushKind, push: SocialPush): Promise<void> {
    try {
      const client = this.supabaseService.getClient();
      const [userResult, tokensResult] = await Promise.all([
        client
          .from('users')
          .select(`push_notifications_opt_in, ${SWITCH_COLUMN[kind]}`)
          .eq('id', userId)
          .maybeSingle(),
        client.from('device_push_tokens').select('expo_push_token').eq('user_id', userId),
      ]);
      const user = userResult.data as Record<string, unknown> | null;
      if (!user || user.push_notifications_opt_in !== true || user[SWITCH_COLUMN[kind]] !== true) {
        return;
      }
      const tokens = ((tokensResult.data ?? []) as { expo_push_token: string }[]).map(
        (row) => row.expo_push_token,
      );
      if (tokens.length === 0) return;
      await this.expoPush.sendAll(
        tokens.map((to) => ({
          to,
          title: push.title,
          body: push.body,
          data: { url: `${APP_LINK_PREFIX}${push.path}` },
        })),
      );
    } catch (err) {
      this.logger.warn(
        `Social push (${kind}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
