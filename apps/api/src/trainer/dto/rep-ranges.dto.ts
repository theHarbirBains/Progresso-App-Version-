import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** A client's own rep range, as their trainer sets it: 1-50 each end (checked min <= max). */
export class ClientRepRangeDto {
  @IsInt()
  @Min(1)
  @Max(50)
  min!: number;

  @IsInt()
  @Min(1)
  @Max(50)
  max!: number;
}

/**
 * One exercise's exception to a client's range: its own range (both ends or neither) and the
 * weight to go up by, in kg. With neither, the exercise goes back to the client's range.
 */
export class ClientExerciseRangeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  min?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  max?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  incrementKg?: number | null;
}
