import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { REMINDERS_QUEUE } from '../queues/queue.constants';
import { RemindersController } from './reminders.controller';
import { RemindersProcessor } from './reminders.processor';
import { RemindersService } from './reminders.service';

@Module({
  imports: [BullModule.registerQueue({ name: REMINDERS_QUEUE })],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersProcessor],
})
export class RemindersModule {}
