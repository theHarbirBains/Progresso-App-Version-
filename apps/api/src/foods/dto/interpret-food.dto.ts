import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const MAX_DESCRIPTION_LENGTH = 300;

export class InterpretFoodDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description!: string;
}
