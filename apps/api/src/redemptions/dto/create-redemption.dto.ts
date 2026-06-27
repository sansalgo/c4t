import { IsString, MinLength } from 'class-validator';

export class CreateRedemptionDto {
  @IsString()
  @MinLength(1)
  rewardOptionId!: string;
}
