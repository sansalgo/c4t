import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerEntryType, LedgerSourceType, MemberRole } from '@workspace/types';
import { PrismaService } from '../prisma/prisma.service';

// Minimal interface so callers (M5, M8) can pass a transaction client without
// importing the full Prisma type. Only the tables we actually touch are needed.
export type LedgerTx = Pick<PrismaService, 'ledgerEntry'>;

export interface CreateLedgerEntryInput {
  familyId: string;
  childUserId: string;
  type: LedgerEntryType;
  amount: number;
  sourceType: LedgerSourceType;
  sourceId?: string;
  note?: string;
  createdById: string;
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Core write primitive — used by this service and by M5/M8 inside their txns ──

  async createEntry(input: CreateLedgerEntryInput, tx?: LedgerTx) {
    const db = tx ?? this.prisma;
    return db.ledgerEntry.create({ data: input });
  }

  // ── Balance ────────────────────────────────────────────────────────────────

  async getBalance(familyId: string, childUserId: string): Promise<number> {
    await this.assertChildInFamily(familyId, childUserId);
    const result = await this.prisma.ledgerEntry.aggregate({
      where: { familyId, childUserId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  // Same as getBalance but accepts a transaction client; no family membership
  // check (caller is responsible) — used inside M8 approval transaction.
  async getBalanceTx(familyId: string, childUserId: string, tx: LedgerTx): Promise<number> {
    const result = await tx.ledgerEntry.aggregate({
      where: { familyId, childUserId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  // ── Entry list ─────────────────────────────────────────────────────────────

  async listEntries(familyId: string, childUserId: string) {
    await this.assertChildInFamily(familyId, childUserId);
    return this.prisma.ledgerEntry.findMany({
      where: { familyId, childUserId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, displayName: true } },
      },
    });
  }

  // ── Manual adjustment by parent ───────────────────────────────────────────

  async adjust(
    familyId: string,
    childUserId: string,
    createdById: string,
    amount: number,
    note?: string,
  ) {
    await this.assertChildInFamily(familyId, childUserId);
    return this.createEntry({
      familyId,
      childUserId,
      type: LedgerEntryType.ADJUST,
      amount,
      sourceType: LedgerSourceType.MANUAL_ADJUST,
      note,
      createdById,
    });
  }

  // ── Guard: child must be a CHILD member of this family ────────────────────

  private async assertChildInFamily(familyId: string, childUserId: string): Promise<void> {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId: childUserId, familyId } },
    });
    if (!membership) throw new NotFoundException('Child not found in this family');
    if (membership.role !== MemberRole.CHILD) {
      throw new BadRequestException('Target user is not a child member of this family');
    }
  }
}
