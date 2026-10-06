import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// A live session a trainer runs for a client. It stays open until the trainer
// finishes it.
export class StartLiveWorkoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

// An exercise the trainer wants to use in a live session, resolved to the client's
// copy when it is the trainer's own.
export class ResolveExerciseDto {
  @IsUUID()
  exerciseId!: string;
}
