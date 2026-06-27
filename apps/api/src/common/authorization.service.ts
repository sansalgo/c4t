import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole } from '@workspace/types';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── DB-backed membership checks ────────────────────────────────────────────

  async assertFamilyParent(userId: string, familyId: string): Promise<void> {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });
    if (!membership) throw new NotFoundException('Family or membership not found');
    if (membership.role !== MemberRole.PARENT) {
      throw new ForbiddenException('Only a parent of this family can perform this action');
    }
  }

  async assertFamilyMember(userId: string, familyId: string): Promise<void> {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });
    if (!membership) throw new ForbiddenException('You are not a member of this family');
  }

  // ── JWT-payload checks (no DB hit) ────────────────────────────────────────

  // Asserts the caller can read a specific child's data (ledger, balance, etc.).
  // Parents can read any child in their family; children can only read their own.
  assertCanAccessChildData(user: AuthenticatedUser, familyId: string, childId: string): void {
    if (user.familyId !== familyId) {
      throw new ForbiddenException('You are not a member of this family');
    }
    if (user.role === MemberRole.PARENT) return;
    if (user.role === MemberRole.CHILD && user.userId === childId) return;
    throw new ForbiddenException('Children can only access their own data');
  }

  assertFamilyParentFromJwt(user: AuthenticatedUser, familyId: string): void {
    if (user.familyId !== familyId || user.role !== MemberRole.PARENT) {
      throw new ForbiddenException('Only a parent of this family can perform this action');
    }
  }
}
