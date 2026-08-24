import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MUSCLE_GROUPS, type MuscleGroup } from '../muscle-group';

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
  @IsBoolean()
  isActive?: boolean;
}
