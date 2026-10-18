import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate',
  'impersonation',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export class CreateReportDto {
  @IsUUID()
  reportedUserId!: string;

  /** The workout the report is about, when it's about one in the Friends feed. */
  @IsOptional()
  @IsUUID()
  workoutId?: string;

  @IsIn(REPORT_REASONS)
  reason!: ReportReason;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  details?: string;
}
