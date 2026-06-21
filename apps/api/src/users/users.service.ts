import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    try {
      return await this.prisma.user.create({ data: dto });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('A user with this email already exists');
      }
      throw err;
    }
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { memberships: { include: { family: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
