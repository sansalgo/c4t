import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { REMINDERS_QUEUE, ReminderJobs } from '../queues/queue.constants';
import { RemindersService } from './reminders.service';

interface DispatchData {
  reminderId: string;
}

@Processor(REMINDERS_QUEUE)
export class RemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(private readonly remindersService: RemindersService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case ReminderJobs.DISPATCH: {
        const { reminderId } = job.data as DispatchData;
        await this.remindersService.dispatch(reminderId);
        break;
      }
      default:
        this.logger.warn(`Unknown reminders job: ${job.name}`);
    }
  }
}
