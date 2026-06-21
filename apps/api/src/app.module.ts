import { Module } from '@nestjs/common';
import { FamilyModule } from './family/family.module';
import { MembershipModule } from './membership/membership.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, UsersModule, FamilyModule, MembershipModule],
})
export class AppModule {}
