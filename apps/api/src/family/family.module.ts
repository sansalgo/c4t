import { Module } from '@nestjs/common';
import { AuthorizationService } from '../common/authorization.service';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';

@Module({
  controllers: [FamilyController],
  providers: [FamilyService, AuthorizationService],
  exports: [FamilyService],
})
export class FamilyModule {}
