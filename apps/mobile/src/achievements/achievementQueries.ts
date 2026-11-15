import type { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// Achievement Points, straight from Supabase: the catalogue (anyone signed in reads it), your
// own awards (your own RLS), and the server's awarding and figures for you
// (award_my_achievements, my_achievement_metrics -- they only ever work on the signed-in
// person, from what's really logged). Nothing here can award anything by itself.

export type AchievementCategory =
  | 'workouts'
  | 'consistency'
  | 'strength'
  | 'nutrition'
  | 'progression'
  | 'exploration'
  | 'volume'
  | 'social';

export interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  ap: number;
  repeats: 'once' | 'weekly' | 'monthly';
  metric: string;
  threshold: number;
  unit: 'count' | 'kg' | 'percent';
  visibility: 'public' | 'private';
  sort: number;
}

export interface AchievementAward {
  achievementId: string;
  periodKey: string;
  ap: number;
  awardedAt: string;
}

/** Your figures, as award_my_achievements measures them: workouts, goal weeks, volume_kg, ... */
export type AchievementMetrics = Record<string, number>;

/** The phone's own time zone ("America/Toronto"), so your weeks and days are your own. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function fetchAchievementDefinitions(): Promise<AchievementDefinition[]> {
  const { data, error } = await supabase
    .from('achievement_definitions')
    .select(
      'id, category, title, description, icon, ap, repeats, metric, threshold, unit, visibility, sort',
    )
    .order('sort');
  if (error) throw new Error(error.message);
  return ((data ?? []) as (AchievementDefinition & { threshold: string | number })[]).map(
    (row) => ({ ...row, threshold: Number(row.threshold) }),
  );
}

type AwardRow = { achievement_id: string; period_key: string; ap: number; awarded_at: string };

function toAward(row: AwardRow): AchievementAward {
  return {
    achievementId: row.achievement_id,
    periodKey: row.period_key,
    ap: row.ap,
    awardedAt: row.awarded_at,
  };
}

/** Every award of yours, oldest first. */
export async function fetchMyAwards(userId: string): Promise<AchievementAward[]> {
  const { data, error } = await supabase
    .from('achievement_awards')
    .select('achievement_id, period_key, ap, awarded_at')
    .eq('user_id', userId)
    .order('awarded_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as AwardRow[]).map(toAward);
}

/** Asks the server to award everything you've reached; returns what's newly awarded. */
export async function awardMyAchievements(): Promise<AchievementAward[]> {
  const { data, error } = await supabase.rpc('award_my_achievements', {
    p_time_zone: deviceTimeZone(),
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as AwardRow[]).map(toAward);
}

export async function fetchMyAchievementMetrics(): Promise<AchievementMetrics> {
  const { data, error } = await supabase.rpc('my_achievement_metrics', {
    p_time_zone: deviceTimeZone(),
  });
  if (error) throw new Error(error.message);
  const metrics: AchievementMetrics = {};
  for (const [key, value] of Object.entries((data ?? {}) as Record<string, unknown>)) {
    metrics[key] = Number(value) || 0;
  }
  return metrics;
}
