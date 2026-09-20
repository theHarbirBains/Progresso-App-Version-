import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { MUSCLE_GROUPS, type MuscleGroup } from '../muscle-group';
import { LOGGING_STYLES, MOVEMENT_TYPES, type LoggingStyle, type MovementType } from '../movement-type';

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
}
