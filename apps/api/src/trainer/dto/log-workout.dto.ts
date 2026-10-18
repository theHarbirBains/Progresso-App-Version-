import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LoggedSetDto {
  @IsInt()
  @Min(1)
  setIndex!: number;

  @IsOptional()
  @IsIn(['none', 'left', 'right'])
  side?: 'none' | 'left' | 'right';

  // What a set holds depends on what its exercise measures: a weight and reps, reps only
  // (bodyweight) or a duration (timed). The database checks the combination against
  // the exercise (20261019100000_bodyweight_and_timed_exercises.sql).

  // Canonical kg, per the CLAUDE.md weight rule. The mobile app converts.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(1000)
  weightKg?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  reps?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86_400)
  durationSeconds?: number;
}

export class LoggedExerciseDto {
  @IsUUID()
  exerciseId!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LoggedSetDto)
  sets!: LoggedSetDto[];
}

export class LogWorkoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsDateString()
  performedAt!: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LoggedExerciseDto)
  exercises!: LoggedExerciseDto[];
}
