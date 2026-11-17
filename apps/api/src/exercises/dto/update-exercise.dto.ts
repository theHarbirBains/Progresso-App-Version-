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
import { trimmedOrNull } from './create-exercise.dto';
import {
  EQUIPMENT,
  LOAD_TYPES,
  LOGGING_STYLES,
  MEASUREMENT_TYPES,
  MOVEMENT_TYPES,
  PULLEY_POSITIONS,
  PULLEYS,
  type Equipment,
  type LoadType,
  type LoggingStyle,
  type MeasurementType,
  type MovementType,
  type Pulley,
  type PulleyPosition,
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

  // Changes new sessions only: each logged exercise keeps the type it was logged as.
  @IsOptional()
  @IsIn(MEASUREMENT_TYPES)
  measurementType?: MeasurementType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Editable at any time, independent of every other field -- omit to leave
  // the stored photo alone, null to clear it, a string to set/replace it.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  photoUrl?: string | null;

  // What sets this machine apart from others like it -- omit to leave one as it is, a blank
  // one clears it (exercises.gym, feel_notes, attachment).
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

  // How it's loaded, and its pulley -- omit to leave one as it is, null clears it.
  @IsOptional()
  @IsIn(LOAD_TYPES)
  loadType?: LoadType | null;

  @IsOptional()
  @IsIn(PULLEYS)
  pulley?: Pulley | null;

  // The setup (exercises.equipment, grip, pulley_position, setup_details) -- each optional, null
  // or a blank clears it. Grip is how it's held; attachment, what's held.
  @IsOptional()
  @IsIn(EQUIPMENT)
  equipment?: Equipment | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimmedOrNull(value))
  @IsString()
  @MaxLength(60)
  grip?: string | null;

  @IsOptional()
  @IsIn(PULLEY_POSITIONS)
  pulleyPosition?: PulleyPosition | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimmedOrNull(value))
  @IsString()
  @MaxLength(300)
  setupDetails?: string | null;
}
