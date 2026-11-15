import type { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// Achievement Points, straight from Supabase: the catalogue and its levels (anyone signed in
// reads them), your own awards and progress (your own RLS), and the server's awarding for you
// (award_my_achievements -- it only ever works on the signed-in person, from what's really
// logged). Nothing here can award anything by itself.

export type AchievementCategory =
  | 'workouts'
  | 'consistency'
  | 'strength'
  | 'muscles'
  | 'progression'
  | 'exploration'
  | 'volume'
  | 'nutrition'
  | 'social';

export interface AchievementLevel {
  level: number;
  /** In the figure's own unit: kg for weight (set in pounds), a count, or a percent. */
  goal: number;
  ap: number;
}

export interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  /** 'single' has one level; 'levels' climbs several, each harder and worth more. */
  kind: 'single' | 'levels';
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  metric: string;
  unit: 'count' | 'kg' | 'percent';
  /** What a goal's figure counts: "workouts", "lifted on biceps". */
  goalLabel: string;
  visibility: 'public' | 'private';
  sort: number;
  /** Lowest first. */
  levels: AchievementLevel[];
}

export interface AchievementAward {
  achievementId: string;
  level: number;
  ap: number;
  awardedAt: string;
}

/** Where you stand on one achievement, as of the last award run. */
export interface AchievementProgressRow {
  achievementId: string;
  value: number;
  level: number;
}

/** The phone's own time zone ("America/Toronto"), so your weeks and days are your own. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function fetchAchievementDefinitions(): Promise<AchievementDefinition[]> {
  const [definitions, levels] = await Promise.all([
    supabase
      .from('achievement_definitions')
      .select(
        'id, category, kind, title, description, icon, metric, unit, goal_label, visibility, sort',
      )
      .order('sort'),
    supabase.from('achievement_levels').select('achievement_id, level, goal, ap').order('level'),
  ]);
  if (definitions.error) throw new Error(definitions.error.message);
  if (levels.error) throw new Error(levels.error.message);
  const byId = new Map<string, AchievementLevel[]>();
  for (const row of (levels.data ?? []) as {
    achievement_id: string;
    level: number;
    goal: string | number;
    ap: number;
  }[]) {
    const list = byId.get(row.achievement_id) ?? [];
    list.push({ level: row.level, goal: Number(row.goal), ap: row.ap });
    byId.set(row.achievement_id, list);
  }
  return (
    (definitions.data ?? []) as (Omit<AchievementDefinition, 'goalLabel' | 'levels'> & {
      goal_label: string;
    })[]
  ).map(({ goal_label, ...row }) => ({
    ...row,
    goalLabel: goal_label,
    levels: (byId.get(row.id) ?? []).sort((a, b) => a.level - b.level),
  }));
}

type AwardRow = { achievement_id: string; level: number; ap: number; awarded_at: string };

function toAward(row: AwardRow): AchievementAward {
  return {
    achievementId: row.achievement_id,
    level: row.level,
    ap: row.ap,
    awardedAt: row.awarded_at,
  };
}

/** Every level awarded to you, oldest first. */
export async function fetchMyAwards(userId: string): Promise<AchievementAward[]> {
  const { data, error } = await supabase
    .from('achievement_awards')
    .select('achievement_id, level, ap, awarded_at')
    .eq('user_id', userId)
    .order('awarded_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as AwardRow[]).map(toAward);
}

/** Where you stand on every achievement. */
export async function fetchMyProgress(userId: string): Promise<AchievementProgressRow[]> {
  const { data, error } = await supabase
    .from('achievement_progress')
    .select('achievement_id, value, level')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { achievement_id: string; value: string | number; level: number }[]).map(
    (row) => ({ achievementId: row.achievement_id, value: Number(row.value), level: row.level }),
  );
}

/** Asks the server to award every level you've reached; returns what's newly awarded. */
export async function awardMyAchievements(): Promise<AchievementAward[]> {
  const { data, error } = await supabase.rpc('award_my_achievements', {
    p_time_zone: deviceTimeZone(),
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as AwardRow[]).map(toAward);
}
