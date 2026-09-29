import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class GetFriendsFeedDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page: number = 0;
}
