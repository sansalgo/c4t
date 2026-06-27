import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateRewardDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  costCarrots!: number;
}
