import { IsDateString, IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

// The details a trainer can give for a client -- adding, tracking or editing
// one: a birthday, and a height and weight, each in its own unit. All optional.
export class ClientDetailsDto {
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
