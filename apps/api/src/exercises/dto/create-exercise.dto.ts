import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { MUSCLE_GROUPS, type MuscleGroup } from '../muscle-group';

export class CreateExerciseDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsIn(MUSCLE_GROUPS)
  muscleGroup!: MuscleGroup;
}
