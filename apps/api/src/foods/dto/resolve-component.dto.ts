import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const MAX_TEXT = 200;

class QuantityDto {
  @IsNumber()
  @Min(0.0001)
  amount!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  unit!: string;
}

class PickDto {
  @IsIn(['progresso_catalog', 'open_food_facts', 'usda_fdc'])
  sourceKind!: 'progresso_catalog' | 'open_food_facts' | 'usda_fdc';

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TEXT)
  sourceId!: string;
}

class ComponentRequestDto {
  @IsInt()
  @Min(0)
  @Max(50)
  index!: number;

  @IsIn(['main', 'ingredient'])
  role!: 'main' | 'ingredient';

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TEXT)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TEXT)
  term!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXT)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  barcode?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuantityDto)
  quantity?: QuantityDto | null;
}

/** Resolves one pending component: after the user picked a candidate, or gave an amount. */
export class ResolveComponentDto {
  @ValidateNested()
  @Type(() => ComponentRequestDto)
  request!: ComponentRequestDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PickDto)
  pick?: PickDto | null;
}
