import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async addMember(familyId: string, dto: AddMemberDto) {
    await this.assertFamilyExists(familyId);
    try {
      return await this.prisma.familyMembership.create({
        data: { familyId, userId: dto.userId, role: dto.role },
        include: { user: true },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('This user is already a member of the family');
      }
      if (err?.code === 'P2003') {
        throw new NotFoundException('User not found');
      }
      throw err;
    }
  }

  async findAll(familyId: string) {
    await this.assertFamilyExists(familyId);
    return this.prisma.familyMembership.findMany({
      where: { familyId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async assertFamilyExists(familyId: string) {
    const exists = await this.prisma.family.findUnique({ where: { id: familyId } });
    if (!exists) throw new NotFoundException('Family not found');
  }
}
