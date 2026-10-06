import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// Give exactly one of: a username (an existing account gets a request), or an
// email (an invite, identical in response whether or not the email has an
// account). The service enforces exactly-one; both fields are optional here.
// The details below only matter for an email invite, and are attached to the
// person when they next sign in.
export class AddClientDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,20}$/)
  username?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsDateString()
  birthday?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(300)
  heightValue?: number;

  @IsOptional()
  @IsIn(['cm', 'ft_in'])
  heightUnit?: 'cm' | 'ft_in';

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  weightValue?: number;

  @IsOptional()
  @IsIn(['kg', 'lb'])
  weightUnit?: 'kg' | 'lb';
}
