import { IsInt, IsOptional, IsString, NotEquals } from 'class-validator';

export class AdjustLedgerDto {
  @IsInt()
  @NotEquals(0)
  amount!: number;

  @IsString()
  @IsOptional()
  note?: string;
}
