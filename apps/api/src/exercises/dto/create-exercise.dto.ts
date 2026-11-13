import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { MUSCLE_GROUPS, type MuscleGroup } from '../muscle-group';
import {
  LOGGING_STYLES,
  MEASUREMENT_TYPES,
  MOVEMENT_TYPES,
  type LoggingStyle,
  type MeasurementType,
  type MovementType,
} from '../movement-type';

/** A typed detail: trimmed, and null when nothing is left -- so a blank box clears it. */
export function trimmedOrNull(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export class CreateExerciseDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsIn(MUSCLE_GROUPS)
  muscleGroup!: MuscleGroup;

  @IsIn(MOVEMENT_TYPES)
  movementType!: MovementType;

  // Required exactly when movementType is 'unilateral' -- ValidateIf skips
  // every validator below it (including IsIn) when the condition is false,
  // so a bilateral exercise never has to supply (or is even checked for)
  // one, while a unilateral exercise with no logging_style fails IsIn on
  // `undefined`, matching the database's own
  // exercises_logging_style_matches_movement_type check constraint.
  @ValidateIf((dto: CreateExerciseDto) => dto.movementType === 'unilateral')
  @IsIn(LOGGING_STYLES)
  loggingStyle?: LoggingStyle;

  // What a set records. Omitted means weight and reps, as every exercise was before.
  @IsOptional()
  @IsIn(MEASUREMENT_TYPES)
  measurementType?: MeasurementType;

  // Optional at create, and editable any time after -- see
  // UpdateExerciseDto. Reuses the same equipment-photos bucket
  // equipment_profiles' own photoUrl already uploads to.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  photoUrl?: string;

  // What sets this machine apart from others like it -- all optional, each trimmed, a blank one
  // left out (exercises.gym, feel_notes, attachment).
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimmedOrNull(value))
  @IsString()
  @MaxLength(60)
  gym?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimmedOrNull(value))
  @IsString()
  @MaxLength(300)
  feelNotes?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimmedOrNull(value))
  @IsString()
  @MaxLength(60)
  attachment?: string | null;
}
