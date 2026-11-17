import { supabase } from '../lib/supabase';
import { setBuiltinSources, type BuiltinExtras, type ExerciseGuide } from './builtinExtras';
import type { Equipment } from './equipment';
import type { MeasurementType, MovementType } from './movementTypes';
import type { MuscleGroup } from './muscleGroups';

// Reads the built-in library's guides (20261128100000_builtin_exercise_library.sql) directly from
// Supabase, like the rest of the library -- built-ins are readable by anyone signed in -- and plugs
// them into builtinExtras.ts as this module loads (the exercise queries load it).
//
// The list's extras come in one query of their own, so nothing that already works ever waits on
// it or breaks without it: if it can't be read (say, before the migration is applied), exercises
// simply show as they always did.

async function readBuiltinExtras(): Promise<Map<string, BuiltinExtras>> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, slug, secondary_muscle_groups, search_aliases, movement_pattern, illustration_url')
    .is('created_by', null)
    .not('slug', 'is', null);
  if (error) throw new Error(error.message);
  const map = new Map<string, BuiltinExtras>();
  for (const row of (data ?? []) as {
    id: string;
    slug: string;
    secondary_muscle_groups: MuscleGroup[] | null;
    search_aliases: string[] | null;
    movement_pattern: string | null;
    illustration_url: string | null;
  }[]) {
    map.set(row.id, {
      slug: row.slug,
      secondaryMuscleGroups: row.secondary_muscle_groups ?? [],
      searchAliases: row.search_aliases ?? [],
      movementPattern: row.movement_pattern,
      illustrationUrl: row.illustration_url,
    });
  }
  return map;
}

async function readGuide(exerciseId: string): Promise<ExerciseGuide | null> {
  const { data, error } = await supabase
    .from('exercises')
    .select(
      'name, muscle_group, equipment, movement_type, measurement_type, slug, secondary_muscle_groups, movement_pattern, instructions, setup_steps, execution_steps, common_mistakes, illustration_url',
    )
    .eq('id', exerciseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    name: string;
    muscle_group: MuscleGroup;
    equipment: Equipment | null;
    movement_type: MovementType;
    measurement_type: MeasurementType | null;
    slug: string | null;
    secondary_muscle_groups: MuscleGroup[] | null;
    movement_pattern: string | null;
    instructions: string | null;
    setup_steps: string[] | null;
    execution_steps: string[] | null;
    common_mistakes: string[] | null;
    illustration_url: string | null;
  };
  return {
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    movementType: row.movement_type,
    measurementType: row.measurement_type ?? 'weight_reps',
    slug: row.slug,
    secondaryMuscleGroups: row.secondary_muscle_groups ?? [],
    movementPattern: row.movement_pattern,
    summary: row.instructions,
    setupSteps: row.setup_steps ?? [],
    executionSteps: row.execution_steps ?? [],
    commonMistakes: row.common_mistakes ?? [],
    illustrationUrl: row.illustration_url,
  };
}

setBuiltinSources({ extras: readBuiltinExtras, guide: readGuide });

export { readBuiltinExtras, readGuide };
