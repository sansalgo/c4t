import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LedgerEntryType, LedgerSourceType, MemberRole, TaskStatus } from '@workspace/types';
import { LedgerService, LedgerTx } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { RECURRENCE_QUEUE, RecurrenceJobs } from '../queues/queue.constants';
import { CreateTaskDto } from './dto/create-task.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const TASK_INCLUDE = {
  assignedTo: { select: { id: true, displayName: true } },
  createdBy: { select: { id: true, displayName: true } },
} as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    @Optional() @InjectQueue(RECURRENCE_QUEUE) private readonly recurrenceQueue: Queue | null,
  ) {}

  // ── M4: CRUD (assignment) ─────────────────────────────────────────────────

  async create(familyId: string, createdById: string, dto: CreateTaskDto) {
    if (dto.assignedToUserId) {
      await this.assertChildInFamily(familyId, dto.assignedToUserId);
    }
    return this.prisma.task.create({
      data: {
        familyId,
        createdById,
        title: dto.title,
        description: dto.description,
        assignedToUserId: dto.assignedToUserId,
        status: dto.assignedToUserId ? TaskStatus.ASSIGNED : TaskStatus.OPEN,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        carrotValue: dto.carrotValue,
        requiresReview: dto.requiresReview ?? false,
        requiresFileOnReview: dto.requiresFileOnReview ?? false,
      },
      include: TASK_INCLUDE,
    });
  }

  async findAll(familyId: string, viewerRole: MemberRole, viewerUserId: string) {
    const where =
      viewerRole === MemberRole.CHILD
        ? { familyId, OR: [{ assignedToUserId: viewerUserId }, { status: TaskStatus.OPEN }] }
        : { familyId };

    return this.prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: TASK_INCLUDE,
    });
  }

  async findOne(familyId: string, id: string, viewerRole: MemberRole, viewerUserId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, familyId },
      include: TASK_INCLUDE,
    });
    if (!task) throw new NotFoundException('Task not found');

    if (
      viewerRole === MemberRole.CHILD &&
      task.assignedToUserId !== viewerUserId &&
      task.status !== TaskStatus.OPEN
    ) {
      throw new ForbiddenException('You can only view tasks assigned to you');
    }

    return task;
  }

  async update(familyId: string, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({ where: { id, familyId } });
    if (!task) throw new NotFoundException('Task not found');

    if (dto.assignedToUserId && dto.assignedToUserId !== task.assignedToUserId) {
      await this.assertChildInFamily(familyId, dto.assignedToUserId);
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        assignedToUserId: dto.assignedToUserId,
        // A parent manually assigning an open task claims it on the child's behalf.
        status:
          dto.assignedToUserId && task.status === TaskStatus.OPEN ? TaskStatus.ASSIGNED : undefined,
        dueAt: dto.dueAt !== undefined ? new Date(dto.dueAt) : undefined,
        carrotValue: dto.carrotValue,
        requiresReview: dto.requiresReview,
        requiresFileOnReview: dto.requiresFileOnReview,
      },
      include: TASK_INCLUDE,
    });
  }

  // Child claims an open task, assigning it to themselves.
  // OPEN → ASSIGNED. The conditional updateMany is the race fence: if two children
  // claim the same task at once, only the first write matches `status: OPEN`.
  async claim(familyId: string, id: string, childUserId: string) {
    const { count } = await this.prisma.task.updateMany({
      where: { id, familyId, status: TaskStatus.OPEN },
      data: { assignedToUserId: childUserId, status: TaskStatus.ASSIGNED },
    });

    if (count === 0) {
      const task = await this.prisma.task.findFirst({ where: { id, familyId } });
      if (!task) throw new NotFoundException('Task not found');
      throw new ConflictException('Task is no longer open to claim');
    }

    return this.prisma.task.findFirst({ where: { id, familyId }, include: TASK_INCLUDE });
  }

  async remove(familyId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, familyId } });
    if (!task) throw new NotFoundException('Task not found');
    await this.prisma.task.delete({ where: { id } });
  }

  // ── M5: Status machine ────────────────────────────────────────────────────

  // Child submits a completed task.
  // ASSIGNED → PENDING_REVIEW  (when requiresReview)
  // ASSIGNED → COMPLETED       (when !requiresReview, EARN entry written atomically)
  async submit(familyId: string, taskId: string, childUserId: string) {
    const { result, recurrenceRuleId } = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, familyId } });
      if (!task) throw new NotFoundException('Task not found');
      if (task.assignedToUserId !== childUserId) {
        throw new ForbiddenException('You can only submit tasks assigned to you');
      }
      if (task.status !== TaskStatus.ASSIGNED) {
        throw new ConflictException(`Task is already ${task.status} — cannot submit`);
      }

      if (task.requiresReview) {
        if (task.requiresFileOnReview) {
          const attachmentCount = await tx.attachment.count({ where: { taskId } });
          if (attachmentCount === 0) {
            throw new BadRequestException(
              'A file attachment is required before this task can be submitted for review',
            );
          }
        }
        const updated = await tx.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.PENDING_REVIEW, rejectionNote: null },
          include: TASK_INCLUDE,
        });
        return { result: updated, recurrenceRuleId: null };
      }

      // No review required — complete immediately and earn carrots in one transaction.
      const updated = await tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.COMPLETED },
        include: TASK_INCLUDE,
      });
      await this.ledgerService.createEntry(
        {
          familyId,
          childUserId,
          type: LedgerEntryType.EARN,
          amount: task.carrotValue,
          sourceType: LedgerSourceType.TASK,
          sourceId: task.id,
          createdById: childUserId,
        },
        tx as unknown as LedgerTx,
      );
      return { result: updated, recurrenceRuleId: task.recurrenceRuleId };
    });

    // After commit: schedule the next occurrence (best-effort; daily scan is the safety net).
    if (recurrenceRuleId && this.recurrenceQueue) {
      await this.recurrenceQueue.add(RecurrenceJobs.MATERIALIZE_NEXT, { recurrenceRuleId });
    }

    return result;
  }

  // Parent approves a pending-review task.
  // PENDING_REVIEW → COMPLETED, EARN entry written atomically.
  // The status guard inside the transaction is the double-credit fence:
  // a second approval attempt finds status === COMPLETED and throws.
  async approve(familyId: string, taskId: string, parentUserId: string) {
    const { result, recurrenceRuleId } = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, familyId } });
      if (!task) throw new NotFoundException('Task not found');
      if (task.status !== TaskStatus.PENDING_REVIEW) {
        throw new ConflictException(`Task is ${task.status} — only PENDING_REVIEW tasks can be approved`);
      }
      // Invariant: a task only reaches PENDING_REVIEW via submit(), which requires an assignee.
      if (!task.assignedToUserId) {
        throw new ConflictException('Task has no assignee');
      }

      const updated = await tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.COMPLETED },
        include: TASK_INCLUDE,
      });
      await this.ledgerService.createEntry(
        {
          familyId,
          childUserId: task.assignedToUserId,
          type: LedgerEntryType.EARN,
          amount: task.carrotValue,
          sourceType: LedgerSourceType.TASK,
          sourceId: task.id,
          createdById: parentUserId,
        },
        tx as unknown as LedgerTx,
      );
      return { result: updated, recurrenceRuleId: task.recurrenceRuleId };
    });

    if (recurrenceRuleId && this.recurrenceQueue) {
      await this.recurrenceQueue.add(RecurrenceJobs.MATERIALIZE_NEXT, { recurrenceRuleId });
    }

    return result;
  }

  // Parent rejects a pending-review task, sending it back to ASSIGNED.
  // No ledger change. Stores a note so the child knows what to fix.
  async reject(familyId: string, taskId: string, dto: RejectTaskDto) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, familyId } });
      if (!task) throw new NotFoundException('Task not found');
      if (task.status !== TaskStatus.PENDING_REVIEW) {
        throw new ConflictException(`Task is ${task.status} — only PENDING_REVIEW tasks can be rejected`);
      }

      return tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.ASSIGNED, rejectionNote: dto.note ?? null },
        include: TASK_INCLUDE,
      });
    });
  }

  // ── Private guards ────────────────────────────────────────────────────────

  private async assertChildInFamily(familyId: string, userId: string): Promise<void> {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });
    if (!membership) throw new BadRequestException('Assigned user is not a member of this family');
    if (membership.role !== MemberRole.CHILD) {
      throw new BadRequestException('Tasks can only be assigned to child members');
    }
  }
}
