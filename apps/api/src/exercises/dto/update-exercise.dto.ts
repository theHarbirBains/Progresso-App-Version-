import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { MUSCLE_GROUPS, type MuscleGroup } from '../muscle-group';
import {
  LOGGING_STYLES,
  MOVEMENT_TYPES,
  type LoggingStyle,
  type MovementType,
} from '../movement-type';

export class UpdateExerciseDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(MUSCLE_GROUPS)
  muscleGroup?: MuscleGroup;

  @IsOptional()
  @IsIn(MOVEMENT_TYPES)
  movementType?: MovementType;

  // Required only when this same request is changing movementType to
  // 'unilateral' -- see CreateExerciseDto's identical comment. Switching to
  // 'bilateral' is handled in the service (always clears logging_style),
  // not here, since that direction has nothing to validate for.
  @ValidateIf((dto: UpdateExerciseDto) => dto.movementType === 'unilateral')
  @IsIn(LOGGING_STYLES)
  loggingStyle?: LoggingStyle;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
