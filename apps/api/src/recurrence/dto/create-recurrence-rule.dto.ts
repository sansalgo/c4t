import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateRecurrenceRuleDto {
  /** iCalendar RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE,FR" */
  @IsString()
  @MinLength(1)
  rule!: string;

  /** Base date from which occurrences are computed (UTC ISO string). */
  @IsDateString()
  startAt!: string;

  @IsDateString()
  @IsOptional()
  endAt?: string;

  @IsString()
  assignedToUserId!: string;

  // ── Task template fields ──────────────────────────────────────────────────

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  carrotValue!: number;

  @IsBoolean()
  @IsOptional()
  requiresReview?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresFileOnReview?: boolean;
}
