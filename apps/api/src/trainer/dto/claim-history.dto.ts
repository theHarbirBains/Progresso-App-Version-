import { IsString, Matches } from 'class-validator';

// The code a trainer gave the client. Dashes and spaces are allowed, and the
// service normalises them away.
export class ClaimHistoryDto {
  @IsString()
  @Matches(/^[A-Za-z0-9 -]{8,12}$/)
  code!: string;
}
