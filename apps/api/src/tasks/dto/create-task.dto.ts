import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  assignedToUserId!: string;

  @IsDateString()
  @IsOptional()
  dueAt?: string;

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
