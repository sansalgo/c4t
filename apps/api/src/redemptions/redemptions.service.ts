import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LedgerEntryType, LedgerSourceType, MemberRole, RedemptionStatus } from '@workspace/types';
import { LedgerService, LedgerTx } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRedemptionDto } from './dto/create-redemption.dto';

const REDEMPTION_INCLUDE = {
  child: { select: { id: true, displayName: true } },
  rewardOption: { select: { id: true, title: true, costCarrots: true } },
  decidedBy: { select: { id: true, displayName: true } },
} as const;

@Injectable()
export class RedemptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
  ) {}

  async create(familyId: string, childUserId: string, dto: CreateRedemptionDto) {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId: childUserId, familyId } },
    });
    if (!membership) throw new ForbiddenException('Not a member of this family');
    if (membership.role !== MemberRole.CHILD) {
      throw new ForbiddenException('Only children can request redemptions');
    }

    const reward = await this.prisma.rewardOption.findFirst({
      where: { id: dto.rewardOptionId, familyId, isActive: true },
    });
    if (!reward) throw new NotFoundException('Reward option not found or not available');

    return this.prisma.redemptionRequest.create({
      data: {
        familyId,
        childUserId,
        rewardOptionId: dto.rewardOptionId,
        costAtRequest: reward.costCarrots, // snapshot — parent editing price later won't affect this
      },
      include: REDEMPTION_INCLUDE,
    });
  }

  async findAll(familyId: string, viewerRole: MemberRole, viewerUserId: string) {
    const where =
      viewerRole === MemberRole.CHILD
        ? { familyId, childUserId: viewerUserId }
        : { familyId };
    return this.prisma.redemptionRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: REDEMPTION_INCLUDE,
    });
  }

  async findOne(familyId: string, id: string, viewerRole: MemberRole, viewerUserId: string) {
    const req = await this.prisma.redemptionRequest.findFirst({
      where: { id, familyId },
      include: REDEMPTION_INCLUDE,
    });
    if (!req) throw new NotFoundException('Redemption request not found');
    if (viewerRole === MemberRole.CHILD && req.childUserId !== viewerUserId) {
      throw new ForbiddenException('You can only view your own redemption requests');
    }
    return req;
  }

  // Parent approves: balance check + SPEND entry, all in one transaction.
  // Status check inside the tx is the double-spend fence.
  async approve(familyId: string, id: string, parentUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.redemptionRequest.findFirst({ where: { id, familyId } });
      if (!req) throw new NotFoundException('Redemption request not found');
      if (req.status !== RedemptionStatus.REQUESTED) {
        throw new ConflictException(`Request is already ${req.status}`);
      }

      // Balance computed from the live ledger inside the tx — not from any cached value.
      const balance = await this.ledgerService.getBalanceTx(
        familyId,
        req.childUserId,
        tx as unknown as LedgerTx,
      );
      if (balance < req.costAtRequest) {
        throw new BadRequestException(
          `Insufficient balance: ${balance} carrots available, ${req.costAtRequest} required`,
        );
      }

      await this.ledgerService.createEntry(
        {
          familyId,
          childUserId: req.childUserId,
          type: LedgerEntryType.SPEND,
          amount: -req.costAtRequest,
          sourceType: LedgerSourceType.REDEMPTION,
          sourceId: req.id,
          createdById: parentUserId,
        },
        tx as unknown as LedgerTx,
      );

      return tx.redemptionRequest.update({
        where: { id },
        data: {
          status: RedemptionStatus.APPROVED,
          decidedById: parentUserId,
          decidedAt: new Date(),
        },
        include: REDEMPTION_INCLUDE,
      });
    });
  }

  // Parent rejects: status → REJECTED, no ledger change.
  async reject(familyId: string, id: string, parentUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const req = await tx.redemptionRequest.findFirst({ where: { id, familyId } });
      if (!req) throw new NotFoundException('Redemption request not found');
      if (req.status !== RedemptionStatus.REQUESTED) {
        throw new ConflictException(`Request is already ${req.status}`);
      }
      return tx.redemptionRequest.update({
        where: { id },
        data: {
          status: RedemptionStatus.REJECTED,
          decidedById: parentUserId,
          decidedAt: new Date(),
        },
        include: REDEMPTION_INCLUDE,
      });
    });
  }

  // Child cancels their own pending request.
  async cancel(familyId: string, id: string, childUserId: string) {
    const req = await this.prisma.redemptionRequest.findFirst({ where: { id, familyId } });
    if (!req) throw new NotFoundException('Redemption request not found');
    if (req.childUserId !== childUserId) {
      throw new ForbiddenException('You can only cancel your own redemption requests');
    }
    if (req.status !== RedemptionStatus.REQUESTED) {
      throw new ConflictException(`Request is already ${req.status} — cannot cancel`);
    }
    return this.prisma.redemptionRequest.update({
      where: { id },
      data: { status: RedemptionStatus.CANCELLED },
      include: REDEMPTION_INCLUDE,
    });
  }
}
