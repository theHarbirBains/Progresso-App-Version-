import { supabase } from '../lib/supabase';
import type { TargetValues } from '../nutrition/targetMath';

// Training phases (training_phases): a cut, a bulk, maintenance or the person's own kind, from
// a start date to an end date (none while it's going). One at a time, never overlapping --
// both enforced by the database. Direct-to-Supabase, own rows only. A phase never changes a
// workout, a log or the daily targets: it only says which targets apply while it's going.

export type PhaseKind = 'cut' | 'bulk' | 'maintenance' | 'custom';

export interface TrainingPhase {
  id: string;
  kind: PhaseKind;
  /** Required for a custom phase, optional otherwise ("Summer Cut"). */
  name: string | null;
  /** "YYYY-MM-DD", local. */
  startDate: string;
  /** "YYYY-MM-DD"; null while the phase is going. */
  endDate: string | null;
  startWeightKg: number | null;
  targetWeightKg: number | null;
  /** The phase's own targets; each null one falls back to the daily target. */
  targets: TargetValues;
  notes: string | null;
}

export type PhaseInput = Omit<TrainingPhase, 'id'>;

interface PhaseDbRow {
  id: string;
  kind: PhaseKind;
  name: string | null;
  start_date: string;
  end_date: string | null;
  start_weight_kg: string | number | null;
  target_weight_kg: string | number | null;
  calories: number | null;
  protein_g: string | number | null;
  carbs_g: string | number | null;
  fat_g: string | number | null;
  notes: string | null;
}

const COLUMNS =
  'id, kind, name, start_date, end_date, start_weight_kg, target_weight_kg, calories, protein_g, carbs_g, fat_g, notes';

const num = (value: string | number | null): number | null =>
  value === null ? null : Number(value);

function toPhase(row: PhaseDbRow): TrainingPhase {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    startWeightKg: num(row.start_weight_kg),
    targetWeightKg: num(row.target_weight_kg),
    targets: {
      calories: row.calories,
      proteinG: num(row.protein_g),
      carbsG: num(row.carbs_g),
      fatG: num(row.fat_g),
    },
    notes: row.notes,
  };
}

function toColumns(input: PhaseInput) {
  return {
    kind: input.kind,
    name: input.name?.trim() || null,
    start_date: input.startDate,
    end_date: input.endDate,
    start_weight_kg: input.startWeightKg,
    target_weight_kg: input.targetWeightKg,
    calories: input.targets.calories,
    protein_g: input.targets.proteinG,
    carbs_g: input.targets.carbsG,
    fat_g: input.targets.fatG,
    notes: input.notes?.trim() || null,
  };
}

/** The database's own words for a broken rule, in plain ones. */
function phaseError(message: string): Error {
  if (/overlap/i.test(message))
    return new Error("Phases can't share days. Pick dates outside your other phases.");
  if (/training_phases_one_active|duplicate key/i.test(message)) {
    return new Error('Only one phase can be going at a time. End the current one first.');
  }
  return new Error(message);
}

/** Every phase the person has, newest first. */
export async function fetchPhases(userId: string): Promise<TrainingPhase[]> {
  const { data, error } = await supabase
    .from('training_phases')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('start_date', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as PhaseDbRow[]).map(toPhase);
}

export async function createPhase(userId: string, input: PhaseInput): Promise<TrainingPhase> {
  const { data, error } = await supabase
    .from('training_phases')
    .insert({ user_id: userId, ...toColumns(input) })
    .select(COLUMNS)
    .single();
  if (error) throw phaseError(error.message);
  return toPhase(data as PhaseDbRow);
}

export async function updatePhase(phaseId: string, input: PhaseInput): Promise<TrainingPhase> {
  const { data, error } = await supabase
    .from('training_phases')
    .update(toColumns(input))
    .eq('id', phaseId)
    .select(COLUMNS)
    .single();
  if (error) throw phaseError(error.message);
  return toPhase(data as PhaseDbRow);
}

/** Ends a phase on this day ("YYYY-MM-DD"). */
export async function endPhase(phaseId: string, endDate: string): Promise<TrainingPhase> {
  const { data, error } = await supabase
    .from('training_phases')
    .update({ end_date: endDate })
    .eq('id', phaseId)
    .select(COLUMNS)
    .single();
  if (error) throw phaseError(error.message);
  return toPhase(data as PhaseDbRow);
}

/** Deletes a phase entered by mistake. Workouts, logs and targets are untouched. */
export async function deletePhase(phaseId: string): Promise<void> {
  const { error } = await supabase.from('training_phases').delete().eq('id', phaseId);
  if (error) throw new Error(error.message);
}
