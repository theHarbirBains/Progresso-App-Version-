import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';

export class SearchUsersDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  query!: string;
}
