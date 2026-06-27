import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CommonModule } from './common/common.module';
import { FamilyModule } from './family/family.module';
import { LedgerModule } from './ledger/ledger.module';
import { MembershipModule } from './membership/membership.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecurrenceModule } from './recurrence/recurrence.module';
import { RedemptionsModule } from './redemptions/redemptions.module';
import { RemindersModule } from './reminders/reminders.module';
import { RewardsModule } from './rewards/rewards.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // ── Infrastructure ──────────────────────────────────────────────────────
    ...(process.env.ENABLE_QUEUES !== 'false'
      ? [
          BullModule.forRoot({
            connection: {
              host: process.env.REDIS_HOST ?? 'localhost',
              port: Number(process.env.REDIS_PORT ?? 6379),
              password: process.env.REDIS_PASSWORD,
            },
          }),
        ]
      : []),
    ScheduleModule.forRoot(),

    // ── Domain ──────────────────────────────────────────────────────────────
    PrismaModule,
    CommonModule,
    AuthModule,
    UsersModule,
    FamilyModule,
    MembershipModule,
    LedgerModule,
    RewardsModule,
    RedemptionsModule,
    TasksModule,
    ...(process.env.ENABLE_QUEUES !== 'false' ? [RecurrenceModule, RemindersModule] : []),
    AttachmentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
