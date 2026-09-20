import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

const MAX_PAGE_SIZE = 30;

export class SearchFoodsDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  query!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  page: number = 0;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = MAX_PAGE_SIZE;
}
