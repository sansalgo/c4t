import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ReminderChannel } from '@workspace/types';
import { PrismaService } from '../prisma/prisma.service';
import { REMINDERS_QUEUE, ReminderJobs } from '../queues/queue.constants';
import { CreateReminderDto } from './dto/create-reminder.dto';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REMINDERS_QUEUE) private readonly queue: Queue,
  ) {}

  async create(taskId: string, userId: string, dto: CreateReminderDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.assignedToUserId !== userId) {
      throw new BadRequestException('You can only set reminders on tasks assigned to you');
    }

    const remindAt = new Date(dto.remindAt);
    if (remindAt <= new Date()) {
      throw new BadRequestException('remindAt must be in the future');
    }

    const reminder = await this.prisma.reminder.create({
      data: {
        taskId,
        userId,
        remindAt,
        channel: dto.channel ?? ReminderChannel.IN_APP,
      },
    });

    // Schedule dispatch — persists in Redis so survives API restarts.
    await this.queue.add(
      ReminderJobs.DISPATCH,
      { reminderId: reminder.id },
      {
        delay: remindAt.getTime() - Date.now(),
        jobId: `reminder-${reminder.id}`, // deduplication key
      },
    );

    return reminder;
  }

  async findAll(taskId: string, userId: string) {
    return this.prisma.reminder.findMany({
      where: { taskId, userId },
      orderBy: { remindAt: 'asc' },
    });
  }

  async remove(taskId: string, reminderId: string, userId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, taskId, userId },
    });
    if (!reminder) throw new NotFoundException('Reminder not found');

    await this.prisma.reminder.delete({ where: { id: reminderId } });

    // Best-effort: remove the pending job from the queue.
    const job = await this.queue.getJob(`reminder-${reminderId}`);
    if (job) await job.remove();
  }

  // Called by the processor when a delayed dispatch job fires.
  async dispatch(reminderId: string): Promise<void> {
    const reminder = await this.prisma.reminder.findUnique({ where: { id: reminderId } });

    // Idempotency guard: skip if already sent or deleted.
    if (!reminder || reminder.sentAt) return;

    await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { sentAt: new Date() },
    });

    // v1: in-app only — notification delivery is a future integration point.
    this.logger.log(
      `Reminder ${reminderId} dispatched via ${reminder.channel} ` +
        `for task ${reminder.taskId} to user ${reminder.userId}`,
    );
  }
}
