import { IsIn } from 'class-validator';

export class RespondTrainerRequestDto {
  @IsIn(['accept', 'decline'])
  action!: 'accept' | 'decline';
}
