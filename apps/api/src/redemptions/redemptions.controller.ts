import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { MemberRole } from '@workspace/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuthorizationService } from '../common/authorization.service';
import { CreateRedemptionDto } from './dto/create-redemption.dto';
import { RedemptionsService } from './redemptions.service';

@Controller('families/:familyId/redemptions')
export class RedemptionsController {
  constructor(
    private readonly redemptionsService: RedemptionsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  // Child requests a redemption.
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Body() dto: CreateRedemptionDto,
  ) {
    if (user.familyId !== familyId || user.role !== MemberRole.CHILD) {
      throw new ForbiddenException('Only children of this family can request redemptions');
    }
    return this.redemptionsService.create(familyId, user.userId, dto);
  }

  // Parent sees all; child sees only their own.
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
  ) {
    if (user.familyId !== familyId) {
      this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    }
    return this.redemptionsService.findAll(familyId, user.role!, user.userId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    if (user.familyId !== familyId) {
      throw new ForbiddenException('You are not a member of this family');
    }
    return this.redemptionsService.findOne(familyId, id, user.role!, user.userId);
  }

  // Parent approves: balance check + SPEND entry written atomically.
  @Post(':id/approve')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.redemptionsService.approve(familyId, id, user.userId);
  }

  // Parent rejects: no ledger change.
  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.redemptionsService.reject(familyId, id, user.userId);
  }

  // Child cancels their own pending request.
  @Delete(':id')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    if (user.familyId !== familyId || user.role !== MemberRole.CHILD) {
      throw new ForbiddenException('Only children of this family can cancel redemption requests');
    }
    return this.redemptionsService.cancel(familyId, id, user.userId);
  }
}
