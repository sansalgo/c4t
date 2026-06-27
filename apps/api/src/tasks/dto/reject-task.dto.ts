import { IsOptional, IsString } from 'class-validator';

export class RejectTaskDto {
  @IsString()
  @IsOptional()
  note?: string;
}
