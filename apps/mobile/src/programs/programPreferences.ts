import type {
  AverageWorkoutLength,
  FitnessGoal,
  ProfileResponse,
  TrainingComfort,
  TrainingExperience,
} from '../lib/api';
import type { HomeEquipment } from './homeEquipment';
import type { ProgramPreferences } from './recommendations';
import type {
  EquipmentAccess,
  PriorityArea,
  ProgramLevel,
  TrainingExclusion,
} from './programTypes';

// What a program recommendation is worked out from, read from the answers someone gave: in
// onboarding (the draft) or since (their profile). Nothing here is asked for its own sake.

/** How confident they are with their training, as the level a program's written for. */
const COMFORT_LEVELS: Record<TrainingComfort, ProgramLevel> = {
  still_learning: 'beginner',
  knows_basics: 'beginner',
  plans_and_progresses: 'intermediate',
  follows_method: 'advanced',
};

const SESSION_MINUTES: Record<AverageWorkoutLength, { min: number; max: number }> = {
  '20_30': { min: 20, max: 30 },
  '30_45': { min: 30, max: 45 },
  '45_60': { min: 45, max: 60 },
  '60_plus': { min: 60, max: 120 },
};

export interface PreferenceAnswers {
  workoutFrequencyDays: number | null;
  trainingComfort: TrainingComfort | null;
  /** An older account's experience, used where they haven't said how confident they are. */
  trainingExperience?: TrainingExperience | null;
  fitnessGoals: FitnessGoal[];
  averageWorkoutLength: AverageWorkoutLength | null;
  trainingPriorities: PriorityArea[];
  equipmentAccess: EquipmentAccess | null;
  trainingExclusions: TrainingExclusion[];
  /** What they have at home; empty when they haven't said. */
  homeEquipment?: HomeEquipment[];
}

export function preferencesFrom(answers: PreferenceAnswers): ProgramPreferences {
  return {
    daysPerWeek: answers.workoutFrequencyDays,
    level: answers.trainingComfort
      ? COMFORT_LEVELS[answers.trainingComfort]
      : (answers.trainingExperience ?? null),
    goals: answers.fitnessGoals,
    priorities: answers.trainingPriorities,
    equipment: answers.equipmentAccess,
    exclusions: answers.trainingExclusions,
    sessionMinutes: answers.averageWorkoutLength
      ? SESSION_MINUTES[answers.averageWorkoutLength]
      : null,
    homeEquipment: answers.homeEquipment ?? [],
  };
}

/** A signed-in person's, from their profile. */
export function preferencesFromProfile(profile: ProfileResponse | null): ProgramPreferences {
  return preferencesFrom({
    workoutFrequencyDays: profile?.workoutFrequencyDays ?? null,
    trainingComfort: profile?.trainingComfort ?? null,
    trainingExperience: profile?.trainingExperience ?? null,
    fitnessGoals: profile?.fitnessGoals ?? [],
    averageWorkoutLength: profile?.averageWorkoutLength ?? null,
    trainingPriorities: profile?.trainingPriorities ?? [],
    equipmentAccess: profile?.equipmentAccess ?? null,
    trainingExclusions: profile?.trainingExclusions ?? [],
    homeEquipment: (profile?.homeEquipment ?? []) as HomeEquipment[],
  });
}
