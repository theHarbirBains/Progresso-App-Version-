import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_PLATFORMS,
  SCREENSHOT_PATH,
  type FeedbackCategory,
} from '../feedback.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateFeedbackDto {
  @IsIn(FEEDBACK_CATEGORIES)
  category!: FeedbackCategory;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  description!: string;

  /** A screenshot the app uploaded first, into the sender's own folder. */
  @IsOptional()
  @IsString()
  @Matches(SCREENSHOT_PATH)
  screenshotPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  buildNumber?: string;

  @IsOptional()
  @IsIn(FEEDBACK_PLATFORMS)
  platform?: (typeof FEEDBACK_PLATFORMS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  osVersion?: string;
}
