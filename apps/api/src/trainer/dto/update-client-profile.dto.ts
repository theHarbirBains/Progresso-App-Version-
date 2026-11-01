import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ClientDetailsDto } from './client-details.dto';

export class UpdateClientProfileDto extends ClientDetailsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName?: string;
}
