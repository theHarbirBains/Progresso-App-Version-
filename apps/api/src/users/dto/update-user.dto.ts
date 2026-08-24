import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const USERNAME_PATTERN = /^[a-z0-9_]+$/;

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName?: string;

  // Lowercased before validation so "Harbir" is accepted and normalized
  // rather than rejected for not already being lowercase — Instagram-style
  // usernames are conventionally case-insensitive from the user's point of
  // view, not case-rejecting.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(USERNAME_PATTERN, {
    message: 'username may only contain lowercase letters, numbers, and underscores',
  })
  username?: string;

  @IsOptional()
  @IsIn(['kg', 'lb'])
  weightUnit?: 'kg' | 'lb';
}
