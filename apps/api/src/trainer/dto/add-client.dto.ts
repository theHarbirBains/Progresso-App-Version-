import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ClientDetailsDto } from './client-details.dto';

// Give exactly one of: a username (an existing account gets a request), or an
// email (an invite, identical in response whether or not the email has an
// account). The service enforces exactly-one; both fields are optional here.
// The details below only matter for an email invite, and are attached to the
// person when they next sign in.
export class AddClientDto extends ClientDetailsDto {
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
}
