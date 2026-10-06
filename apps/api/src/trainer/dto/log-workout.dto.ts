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

  // Canonical kg, per the CLAUDE.md weight rule. The mobile app converts.
  @IsNumber()
  @IsPositive()
  @Max(1000)
  weightKg!: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  reps!: number;
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
