import { Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole } from '@workspace/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFamilyDto } from './dto/create-family.dto';

@Injectable()
export class FamilyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(creatorUserId: string, dto: CreateFamilyDto) {
    return this.prisma.$transaction(async (tx) => {
      const family = await tx.family.create({ data: { name: dto.name } });
      await tx.familyMembership.create({
        data: { familyId: family.id, userId: creatorUserId, role: MemberRole.PARENT },
      });
      return family;
    });
  }

  async findOne(id: string) {
    const family = await this.prisma.family.findUnique({
      where: { id },
      include: { memberships: { include: { user: true } } },
    });
    if (!family) throw new NotFoundException('Family not found');
    return family;
  }
}
