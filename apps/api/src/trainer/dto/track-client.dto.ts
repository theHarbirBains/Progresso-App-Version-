import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// A client the trainer tracks before they have an account. Only a name is
// required. The details are for the trainer's own record, and the client keeps
// them when they claim the history (filled only where they have not set their own).
export class TrackClientDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  displayName!: string;

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
