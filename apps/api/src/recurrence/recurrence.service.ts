import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { RRule } from 'rrule';
import { MemberRole } from '@workspace/types';
import { PrismaService } from '../prisma/prisma.service';
import { RECURRENCE_QUEUE, RecurrenceJobs } from '../queues/queue.constants';
import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { UpdateRecurrenceRuleDto } from './dto/update-recurrence-rule.dto';

@Injectable()
export class RecurrenceService {
  private readonly logger = new Logger(RecurrenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(RECURRENCE_QUEUE) private readonly queue: Queue,
  ) {}

  async create(familyId: string, createdById: string, dto: CreateRecurrenceRuleDto) {
    this.validateRrule(dto.rule);
    await this.assertChildInFamily(familyId, dto.assignedToUserId);

    const startAt = new Date(dto.startAt);

    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.recurrenceRule.create({
        data: {
          familyId,
          createdById,
          assignedToUserId: dto.assignedToUserId,
          rule: dto.rule,
          startAt,
          endAt: dto.endAt ? new Date(dto.endAt) : undefined,
          title: dto.title,
          description: dto.description,
          carrotValue: dto.carrotValue,
          requiresReview: dto.requiresReview ?? false,
          requiresFileOnReview: dto.requiresFileOnReview ?? false,
        },
      });

      // Materialise the first task instance immediately (startAt is the first due date).
      await tx.task.create({
        data: {
          familyId,
          createdById,
          assignedToUserId: dto.assignedToUserId,
          recurrenceRuleId: rule.id,
          title: dto.title,
          description: dto.description,
          dueAt: startAt,
          carrotValue: dto.carrotValue,
          requiresReview: dto.requiresReview ?? false,
          requiresFileOnReview: dto.requiresFileOnReview ?? false,
        },
      });

      return rule;
    });
  }

  async findAll(familyId: string) {
    return this.prisma.recurrenceRule.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, displayName: true } },
        _count: { select: { tasks: true } },
      },
    });
  }

  async findOne(familyId: string, id: string) {
    const rule = await this.prisma.recurrenceRule.findFirst({
      where: { id, familyId },
      include: {
        assignedTo: { select: { id: true, displayName: true } },
        tasks: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!rule) throw new NotFoundException('Recurrence rule not found');
    return rule;
  }

  async update(familyId: string, id: string, dto: UpdateRecurrenceRuleDto) {
    const rule = await this.prisma.recurrenceRule.findFirst({ where: { id, familyId } });
    if (!rule) throw new NotFoundException('Recurrence rule not found');
    return this.prisma.recurrenceRule.update({
      where: { id },
      data: { endAt: dto.endAt ? new Date(dto.endAt) : null },
    });
  }

  // ── Job: materialise the next task after a recurring task is completed ─────

  async materializeNext(recurrenceRuleId: string): Promise<void> {
    const rule = await this.prisma.recurrenceRule.findUnique({
      where: { id: recurrenceRuleId },
    });
    if (!rule) return;
    if (rule.endAt && rule.endAt <= new Date()) {
      this.logger.debug(`Recurrence rule ${recurrenceRuleId} has expired`);
      return;
    }

    // Find the most recent materialized task for this rule to use as the anchor.
    const latest = await this.prisma.task.findFirst({
      where: { recurrenceRuleId },
      orderBy: { dueAt: 'desc' },
    });
    const after = latest?.dueAt ?? rule.startAt;

    const rrule = new RRule({ ...RRule.parseString(rule.rule), dtstart: rule.startAt });
    const next = rrule.after(after, false /* exclusive */);

    if (!next) {
      this.logger.debug(`No further occurrences for rule ${recurrenceRuleId}`);
      return;
    }
    if (rule.endAt && next > rule.endAt) {
      this.logger.debug(`Next occurrence ${next.toISOString()} exceeds endAt for rule ${recurrenceRuleId}`);
      return;
    }

    // Idempotency: skip if a task for this exact due date already exists.
    const existing = await this.prisma.task.findFirst({
      where: { recurrenceRuleId, dueAt: next },
    });
    if (existing) {
      this.logger.debug(`Task for occurrence ${next.toISOString()} already exists`);
      return;
    }

    await this.prisma.task.create({
      data: {
        familyId: rule.familyId,
        createdById: rule.createdById,
        assignedToUserId: rule.assignedToUserId,
        recurrenceRuleId: rule.id,
        title: rule.title,
        description: rule.description,
        dueAt: next,
        carrotValue: rule.carrotValue,
        requiresReview: rule.requiresReview,
        requiresFileOnReview: rule.requiresFileOnReview,
      },
    });

    this.logger.log(`Materialised next task for rule ${recurrenceRuleId} due ${next.toISOString()}`);
  }

  // ── Safety-net CRON: scan all active rules and enqueue any missed jobs ─────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async enqueueMissedMaterializations(): Promise<void> {
    const activeRules = await this.prisma.recurrenceRule.findMany({
      where: { OR: [{ endAt: null }, { endAt: { gt: new Date() } }] },
      select: { id: true },
    });

    for (const { id } of activeRules) {
      await this.queue.add(RecurrenceJobs.MATERIALIZE_NEXT, { recurrenceRuleId: id });
    }

    this.logger.log(`Enqueued ${activeRules.length} recurrence materialization jobs (daily scan)`);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private validateRrule(ruleStr: string): void {
    try {
      RRule.parseString(ruleStr);
    } catch {
      throw new BadRequestException(`Invalid RRULE string: "${ruleStr}"`);
    }
  }

  private async assertChildInFamily(familyId: string, userId: string): Promise<void> {
    const m = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });
    if (!m) throw new BadRequestException('Assigned user is not a member of this family');
    if (m.role !== MemberRole.CHILD) {
      throw new BadRequestException('Recurring tasks can only be assigned to child members');
    }
  }
}
