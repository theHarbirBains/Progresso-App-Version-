import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// What the app sends from Apple Health (Phase 3): each day's values and each sleep, as read on
// the phone. These check only the shape; which metric, unit, source and range a value may have is
// checked value by value (health-normalise.ts), so one bad reading is refused without the rest.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** At most this many daily values in one sync: 90 days of every metric, with room to spare. */
export const MAX_VALUES_PER_SYNC = 5000;
export const MAX_SLEEP_PER_SYNC = 1000;

export class HealthValueDto {
  @Matches(DAY)
  day!: string;

  @IsString()
  @MaxLength(40)
  metric!: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  value!: number;

  /** The unit it's in; the metric's own when left out. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  device?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  sampleCount?: number;

  @IsOptional()
  @IsISO8601()
  measuredAt?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  sourceRef?: string;
}

/** A value the source no longer has (deleted in Apple Health). */
export class ClearedValueDto {
  @Matches(DAY)
  day!: string;

  @IsString()
  @MaxLength(40)
  metric!: string;
}

export class SleepSessionDto {
  @IsString()
  @Length(1, 200)
  sourceRef!: string;

  @IsISO8601()
  startedAt!: string;

  @IsISO8601()
  endedAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  inBedS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  asleepS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  awakeS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  remS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  lightS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400)
  deepS?: number;

  @IsOptional()
  @IsBoolean()
  isNap?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  device?: string;
}

export class AppleHealthImportDto {
  @IsIn(['connect', 'app_open', 'manual', 'backfill'])
  trigger!: 'connect' | 'app_open' | 'manual' | 'backfill';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VALUES_PER_SYNC)
  @ValidateNested({ each: true })
  @Type(() => HealthValueDto)
  values?: HealthValueDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VALUES_PER_SYNC)
  @ValidateNested({ each: true })
  @Type(() => ClearedValueDto)
  cleared?: ClearedValueDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SLEEP_PER_SYNC)
  @ValidateNested({ each: true })
  @Type(() => SleepSessionDto)
  sleep?: SleepSessionDto[];

  /** Sleeps the source no longer has, by their sourceRef. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_SLEEP_PER_SYNC)
  @IsString({ each: true })
  @Length(1, 200, { each: true })
  clearedSleep?: string[];

  /** What's behind the connection ("iPhone", "Apple Watch"); left out keeps what it had. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 80, { each: true })
  devices?: string[];

  /** The data types the person allowed; left out keeps what it had. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 60, { each: true })
  granted?: string[];
}

/** A night (or a nap) someone logs themselves. */
export class ManualSleepDto {
  @IsISO8601()
  startedAt!: string;

  @IsISO8601()
  endedAt!: string;

  /** Time asleep, where they know it; the whole time in bed otherwise. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  asleepMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isNap?: boolean;
}

/** "Delete my health data": one source's, or (without one) all of it. */
export class DeleteHealthDataQueryDto {
  @IsOptional()
  @IsIn(['apple_health', 'oura', 'manual'])
  source?: 'apple_health' | 'oura' | 'manual';
}
