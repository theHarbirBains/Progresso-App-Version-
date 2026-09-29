import { IsIn } from 'class-validator';

export class RespondFollowRequestDto {
  @IsIn(['accept', 'reject'])
  action!: 'accept' | 'reject';
}
