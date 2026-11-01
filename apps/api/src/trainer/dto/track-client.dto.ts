import { IsString, MaxLength, MinLength } from 'class-validator';
import { ClientDetailsDto } from './client-details.dto';

// A client the trainer tracks before they have an account. Only a name is
// required. The details are for the trainer's own record, and the client keeps
// them when they claim the history (filled only where they have not set their own).
export class TrackClientDto extends ClientDetailsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;
}
