import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

// Status transitions are intentionally absent — that belongs to M5 (task lifecycle).
// A child can never hit this DTO; it is parent-only (enforced in the controller).
export class UpdateTaskDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  assignedToUserId?: string;

  @IsDateString()
  @IsOptional()
  dueAt?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  carrotValue?: number;

  @IsBoolean()
  @IsOptional()
  requiresReview?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresFileOnReview?: boolean;
}
