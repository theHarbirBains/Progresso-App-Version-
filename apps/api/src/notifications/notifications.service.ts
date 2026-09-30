import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { PushTokenPlatform } from './dto/register-push-token.dto';
import {
  buildNextWorkoutMessage,
  computeNextWorkoutDay,
  type SplitDayForReminder,
} from './next-workout.util';
import { ExpoPushProvider, type ExpoPushMessage } from './providers/expo-push.provider';

const FOOD_LOG_REMINDER_THRESHOLD_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DailyNotificationsResult {
  workoutRemindersSent: number;
  foodRemindersSent: number;
}

interface UserForReminder {
  id: string;
  displayName: string | null;
  activeWorkoutSplitId: string | null;
}

/**
 * Real push notification delivery, via Expo's push service (see
 * ExpoPushProvider) -- device token registration, and the daily reminder
 * job itself (see notifications.controller.ts for how that job actually
 * gets triggered; this backend has no in-process scheduler of its own).
 *
 * Two reminder types today: the next workout in the user's active split's
 * rotation (mirrors the mobile app's own Feed widget -- see
 * next-workout.util.ts), and a nudge for anyone who hasn't logged a meal
 * in a few days. Both are logged (notification_log) the moment they're
 * queued for sending, so a job run that's triggered twice in one day never
 * double-sends either one to the same user.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly expoPush: ExpoPushProvider,
  ) {}

  async registerToken(
    userId: string,
    expoPushToken: string,
    platform: PushTokenPlatform,
  ): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('device_push_tokens')
      .upsert(
        { user_id: userId, expo_push_token: expoPushToken, platform },
        { onConflict: 'user_id,expo_push_token' },
      );
    if (error) throw new InternalServerErrorException('Failed to register push token');
  }

  async unregisterToken(userId: string, expoPushToken: string): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('device_push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('expo_push_token', expoPushToken);
    if (error) throw new InternalServerErrorException('Failed to remove push token');
  }

  async sendDailyNotifications(): Promise<DailyNotificationsResult> {
    const tokensByUser = await this.fetchTokensByUser();
    const userIds = [...tokensByUser.keys()];
    if (userIds.length === 0) return { workoutRemindersSent: 0, foodRemindersSent: 0 };

    const [users, alreadySentToday, lastFoodLogByUser] = await Promise.all([
      this.fetchUsers(userIds),
      this.fetchAlreadySentToday(userIds),
      this.fetchLastFoodLogByUser(userIds),
    ]);

    let workoutRemindersSent = 0;
    let foodRemindersSent = 0;
    const messages: ExpoPushMessage[] = [];

    for (const user of users) {
      const tokens = tokensByUser.get(user.id) ?? [];
      if (tokens.length === 0) continue;

      if (user.activeWorkoutSplitId && !alreadySentToday.has(`${user.id}:next_workout`)) {
        const day = await this.computeNextWorkoutDayForUser(user.id, user.activeWorkoutSplitId);
        if (day) {
          const body = buildNextWorkoutMessage(user.displayName, day);
          for (const token of tokens) messages.push({ to: token, title: 'Time to train', body });
          await this.logSent(user.id, 'next_workout');
          workoutRemindersSent++;
        }
      }

      const lastLoggedAt = lastFoodLogByUser.get(user.id) ?? null;
      const daysSinceLastLog = lastLoggedAt
        ? Math.floor((Date.now() - new Date(lastLoggedAt).getTime()) / MS_PER_DAY)
        : Infinity;
      if (
        daysSinceLastLog >= FOOD_LOG_REMINDER_THRESHOLD_DAYS &&
        !alreadySentToday.has(`${user.id}:food_log_reminder`)
      ) {
        const body =
          "It's been a few days since you logged a meal -- keep your nutrition on track.";
        for (const token of tokens) messages.push({ to: token, title: 'Progresso', body });
        await this.logSent(user.id, 'food_log_reminder');
        foodRemindersSent++;
      }
    }

    if (messages.length > 0) {
      await this.expoPush.sendAll(messages);
    }

    return { workoutRemindersSent, foodRemindersSent };
  }

  private async fetchTokensByUser(): Promise<Map<string, string[]>> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('device_push_tokens')
      .select('user_id, expo_push_token');
    if (error) throw new InternalServerErrorException('Failed to load push tokens');

    const map = new Map<string, string[]>();
    for (const row of data ?? []) {
      const list = map.get(row.user_id) ?? [];
      list.push(row.expo_push_token);
      map.set(row.user_id, list);
    }
    return map;
  }

  private async fetchUsers(userIds: string[]): Promise<UserForReminder[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id, display_name, active_workout_split_id')
      .in('id', userIds);
    if (error) throw new InternalServerErrorException('Failed to load users');

    return (data ?? []).map((row) => ({
      id: row.id as string,
      displayName: (row.display_name as string | null) ?? null,
      activeWorkoutSplitId: (row.active_workout_split_id as string | null) ?? null,
    }));
  }

  private async fetchAlreadySentToday(userIds: string[]): Promise<Set<string>> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('notification_log')
      .select('user_id, notification_type')
      .in('user_id', userIds)
      .gte('sent_at', startOfDay.toISOString());
    if (error) throw new InternalServerErrorException("Failed to check today's notification log");

    return new Set((data ?? []).map((row) => `${row.user_id}:${row.notification_type}`));
  }

  private async fetchLastFoodLogByUser(userIds: string[]): Promise<Map<string, string>> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('food_logs')
      .select('user_id, logged_at')
      .in('user_id', userIds)
      .order('logged_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to load food logs');

    const map = new Map<string, string>();
    for (const row of data ?? []) {
      // Rows arrive newest-first, and a Map only overwrites on a repeated
      // set() -- so guarding with has() keeps each user's FIRST-seen (i.e.
      // most recent) row and skips every later, older one for that user.
      if (!map.has(row.user_id)) map.set(row.user_id, row.logged_at);
    }
    return map;
  }

  /**
   * One extra pair of queries per user with an active split and no
   * reminder sent yet today -- not batched across users. Acceptable for
   * now: this only runs once a day, and "has a push token AND an active
   * split AND hasn't been reminded today" is a small fraction of the whole
   * user base. Revisit if that stops being true.
   */
  private async computeNextWorkoutDayForUser(
    userId: string,
    activeWorkoutSplitId: string,
  ): Promise<SplitDayForReminder | null> {
    const [days, lastCompletedDayId] = await Promise.all([
      this.fetchSplitDaysWithMuscleGroups(activeWorkoutSplitId),
      this.fetchLastCompletedSplitDayId(userId),
    ]);
    return computeNextWorkoutDay(days, lastCompletedDayId);
  }

  private async fetchSplitDaysWithMuscleGroups(splitId: string): Promise<SplitDayForReminder[]> {
    const { data: days, error: daysError } = await this.supabaseService
      .getClient()
      .from('workout_split_days')
      .select('id, name, order_index')
      .eq('workout_split_id', splitId)
      .order('order_index', { ascending: true });
    if (daysError) throw new InternalServerErrorException('Failed to load split days');

    const dayIds = (days ?? []).map((d) => d.id as string);
    const muscleGroupsByDay = new Map<string, string[]>();
    if (dayIds.length > 0) {
      const { data: groups, error: groupsError } = await this.supabaseService
        .getClient()
        .from('workout_split_day_muscle_groups')
        .select('workout_split_day_id, muscle_group')
        .in('workout_split_day_id', dayIds);
      if (groupsError) {
        throw new InternalServerErrorException('Failed to load split day muscle groups');
      }
      for (const row of groups ?? []) {
        const list = muscleGroupsByDay.get(row.workout_split_day_id) ?? [];
        list.push(row.muscle_group);
        muscleGroupsByDay.set(row.workout_split_day_id, list);
      }
    }

    return (days ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      orderIndex: row.order_index as number,
      muscleGroups: muscleGroupsByDay.get(row.id as string) ?? [],
    }));
  }

  private async fetchLastCompletedSplitDayId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('workouts')
      .select('workout_split_day_id')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .not('workout_split_day_id', 'is', null)
      .is('deleted_at', null)
      .order('performed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load last completed workout');

    return (data?.workout_split_day_id as string | undefined) ?? null;
  }

  private async logSent(userId: string, type: 'next_workout' | 'food_log_reminder'): Promise<void> {
    const { error } = await this.supabaseService
      .getClient()
      .from('notification_log')
      .insert({ user_id: userId, notification_type: type });
    if (error) {
      // A logging failure shouldn't un-send a notification that already
      // went out -- worst case tomorrow's run (or a retried trigger later
      // today) finds it "not yet sent today" again and sends a duplicate,
      // not a data-integrity problem.
      this.logger.warn(`Failed to record sent notification: ${error.message}`);
    }
  }
}
