import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** A page of a person's workouts. */
export class PersonWorkoutsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page: number = 0;
}

/**
 * Contact emails and phone numbers as SHA-256 hashes (lower-case hex) -- never the addresses or
 * numbers themselves. `hashes` are the emails (the name app versions before phone numbers send).
 */
export class MatchContactsDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @Matches(/^[0-9a-f]{64}$/i, { each: true })
  hashes!: string[];

  /** The contacts' phone numbers, each in E.164 form, hashed. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @Matches(/^[0-9a-f]{64}$/i, { each: true })
  phoneHashes?: string[];
}

export class SocialSummaryDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  workoutIds!: string[];
}

export class CreateCommentDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  body!: string;
}
