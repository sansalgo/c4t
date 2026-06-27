import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { RECURRENCE_QUEUE, RecurrenceJobs } from '../queues/queue.constants';
import { RecurrenceService } from './recurrence.service';

interface MaterializeNextData {
  recurrenceRuleId: string;
}

@Processor(RECURRENCE_QUEUE)
export class RecurrenceProcessor extends WorkerHost {
  private readonly logger = new Logger(RecurrenceProcessor.name);

  constructor(private readonly recurrenceService: RecurrenceService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case RecurrenceJobs.MATERIALIZE_NEXT: {
        const { recurrenceRuleId } = job.data as MaterializeNextData;
        await this.recurrenceService.materializeNext(recurrenceRuleId);
        break;
      }
      case RecurrenceJobs.DAILY_SCAN: {
        await this.recurrenceService.enqueueMissedMaterializations();
        break;
      }
      default:
        this.logger.warn(`Unknown recurrence job: ${job.name}`);
    }
  }
}
