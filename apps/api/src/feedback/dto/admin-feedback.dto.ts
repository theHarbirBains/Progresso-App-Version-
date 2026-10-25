import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  type FeedbackCategory,
  type FeedbackStatus,
} from '../feedback.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ListFeedbackQueryDto {
  @IsOptional()
  @IsIn(FEEDBACK_STATUSES)
  status?: FeedbackStatus;

  @IsOptional()
  @IsIn(FEEDBACK_CATEGORIES)
  category?: FeedbackCategory;

  /** Words in the title or description. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  /** The next page: what was sent before this moment (the last page's nextBefore). */
  @IsOptional()
  @IsISO8601()
  before?: string;
}

export class UpdateFeedbackStatusDto {
  @IsIn(FEEDBACK_STATUSES)
  status!: FeedbackStatus;
}

export class AddFeedbackNoteDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
