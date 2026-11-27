import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

/** Which of their notifications to mark read: these ids, or (without any) every one. */
export class MarkNotificationsReadDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids?: string[];
}
