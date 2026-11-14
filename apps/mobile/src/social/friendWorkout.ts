import type { MeasurementType, MovementType } from '../exercises/movementTypes';
import type { MuscleGroup } from '../exercises/muscleGroups';
import type { FriendWorkout } from '../lib/socialApi';
import type { WorkoutDetail } from '../workouts/workoutQueries';

/**
 * A followed person's workout (from the API) in the shape the workout page draws -- the same
 * exercises, machines and logged sets as their own page shows, read-only.
 */
export function friendWorkoutDetail(workout: FriendWorkout): WorkoutDetail {
  return {
    id: workout.id,
    name: workout.name,
    performedAt: workout.performedAt,
    completedAt: workout.completedAt,
    workoutSplitDayId: null,
    groupId: null,
    exercises: workout.exercises.map((exercise) => ({
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      photoUrl: exercise.photoUrl,
      gym: exercise.gym,
      attachment: exercise.attachment,
      muscleGroup: exercise.muscleGroup as MuscleGroup,
      movementType: exercise.movementType as MovementType,
      loggingStyle: null,
      measurementType: exercise.measurementType as MeasurementType,
      orderIndex: exercise.orderIndex,
      sets: exercise.sets.map((set) => ({
        id: set.id,
        setIndex: set.setIndex,
        side: set.side,
        weightKg: set.weightKg,
        reps: set.reps,
        durationSeconds: set.durationSeconds,
        completedAt: set.completedAt,
      })),
    })),
  };
}
