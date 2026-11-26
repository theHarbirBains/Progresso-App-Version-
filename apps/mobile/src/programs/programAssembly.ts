import type {
  CatalogProgram,
  CatalogVariation,
  ProgramContent,
  ProgramVariation,
  ResolvedVariation,
  VariationContent,
  WorkoutProgram,
} from './programTypes';

/** Whether a variation's programming is complete enough to show: every day has its exercises. */
export function isReadyContent(content: VariationContent | undefined): content is VariationContent {
  return (
    content !== undefined &&
    content.days.length > 0 &&
    content.days.every((day) => day.exercises.length > 0)
  );
}

/** A catalogue variation's whole profile: its program's, changed where the variation says so. */
export function resolveVariation(
  program: CatalogProgram,
  variation: CatalogVariation,
): ResolvedVariation {
  return {
    id: variation.id,
    daysPerWeek: variation.daysPerWeek,
    focus: variation.focus,
    default: variation.default,
    categories: variation.categories ?? program.profile.categories,
    style: variation.style ?? program.profile.style,
    goals: variation.goals ?? program.profile.goals,
    levels: variation.levels ?? program.profile.levels ?? [],
    equipment: variation.equipment ?? program.profile.equipment ?? 'full_gym',
    emphasis: variation.emphasis ?? program.profile.emphasis ?? [],
    excludes: variation.excludes ?? program.profile.excludes ?? [],
  };
}

/**
 * The programs the app shows: each catalogue program with only its variations whose programming
 * is in (Harbir's: never an empty or made-up variation), and none of the programs with no such
 * variation. A variation's days a week are its days; its profile is its program's, changed where
 * the catalogue changes it.
 */
export function assemblePrograms(
  catalog: readonly CatalogProgram[],
  content: Readonly<Record<string, ProgramContent>>,
): WorkoutProgram[] {
  const programs: WorkoutProgram[] = [];
  for (const program of catalog) {
    const words = content[program.id];
    if (!words) continue;
    const variations: ProgramVariation[] = [];
    for (const variation of program.variations) {
      const made = words.variations[variation.id];
      if (!isReadyContent(made)) continue;
      const daysPerWeek = made.days.length;
      variations.push({
        ...resolveVariation(program, variation),
        daysPerWeek,
        schedule: `${daysPerWeek}-Day`,
        scheduleNote: made.scheduleNote,
        focusNote: made.focusNote,
        note: made.note,
        sessionMinutes: made.sessionMinutes,
        days: made.days,
      });
    }
    if (variations.length === 0) continue;
    programs.push({
      id: program.id,
      name: program.name,
      setting: program.setting ?? 'gym',
      description: words.description,
      tags: words.tags,
      badge: words.badge,
      benefits: words.benefits,
      guidance: words.guidance,
      variations,
    });
  }
  return programs;
}
