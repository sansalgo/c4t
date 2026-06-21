import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole } from '@workspace/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throws ForbiddenException if userId is not a PARENT of familyId.
   * Call this at the top of every mutating endpoint that requires parent authority.
   * In M2, replace the userId parameter with the value from the session.
   */
  async assertFamilyParent(userId: string, familyId: string): Promise<void> {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });
    if (!membership) {
      throw new NotFoundException('Family or membership not found');
    }
    if (membership.role !== MemberRole.PARENT) {
      throw new ForbiddenException('Only a parent of this family can perform this action');
    }
  }

  async assertFamilyMember(userId: string, familyId: string): Promise<void> {
    const membership = await this.prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId, familyId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this family');
    }
  }
}
