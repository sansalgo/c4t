import { Injectable, NotFoundException } from '@nestjs/common';
import { MemberRole } from '@workspace/types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(familyId: string, createdById: string, dto: CreateRewardDto) {
    return this.prisma.rewardOption.create({
      data: { familyId, createdById, ...dto },
    });
  }

  // Parents see all (active + inactive); children see only active options.
  async findAll(familyId: string, role: MemberRole) {
    const where =
      role === MemberRole.CHILD ? { familyId, isActive: true } : { familyId };
    return this.prisma.rewardOption.findMany({
      where,
      orderBy: { costCarrots: 'asc' },
    });
  }

  async findOne(familyId: string, id: string) {
    const reward = await this.prisma.rewardOption.findFirst({ where: { id, familyId } });
    if (!reward) throw new NotFoundException('Reward option not found');
    return reward;
  }

  async update(familyId: string, id: string, dto: UpdateRewardDto) {
    await this.findOne(familyId, id);
    return this.prisma.rewardOption.update({ where: { id }, data: dto });
  }

  // Soft-delete: mark inactive rather than removing the row.
  // Active redemption requests referencing this reward remain valid.
  async deactivate(familyId: string, id: string) {
    await this.findOne(familyId, id);
    return this.prisma.rewardOption.update({ where: { id }, data: { isActive: false } });
  }
}
