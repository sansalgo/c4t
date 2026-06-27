import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { RECURRENCE_QUEUE } from '../queues/queue.constants';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    LedgerModule,
    ...(process.env.ENABLE_QUEUES !== 'false'
      ? [BullModule.registerQueue({ name: RECURRENCE_QUEUE })]
      : []),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
