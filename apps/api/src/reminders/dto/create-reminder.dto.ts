import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ReminderChannel } from '@workspace/types';

export class CreateReminderDto {
  @IsDateString()
  remindAt!: string;

  @IsEnum(ReminderChannel)
  @IsOptional()
  channel?: ReminderChannel;
}
