import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RECURRENCE_QUEUE } from '../queues/queue.constants';
import { RecurrenceController } from './recurrence.controller';
import { RecurrenceProcessor } from './recurrence.processor';
import { RecurrenceService } from './recurrence.service';

@Module({
  imports: [BullModule.registerQueue({ name: RECURRENCE_QUEUE })],
  controllers: [RecurrenceController],
  providers: [RecurrenceService, RecurrenceProcessor],
  exports: [RecurrenceService],
})
export class RecurrenceModule {}
