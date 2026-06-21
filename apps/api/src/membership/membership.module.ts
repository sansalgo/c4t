import { Module } from '@nestjs/common';
import { AuthorizationService } from '../common/authorization.service';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';

@Module({
  controllers: [MembershipController],
  providers: [MembershipService, AuthorizationService],
})
export class MembershipModule {}
