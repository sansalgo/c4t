import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuthorizationService } from '../common/authorization.service';
import { AddMemberDto } from './dto/add-member.dto';
import { MembershipService } from './membership.service';

@Controller('families/:familyId/members')
export class MembershipController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Post()
  async addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Body() dto: AddMemberDto,
  ) {
    await this.authorizationService.assertFamilyParent(user.userId, familyId);
    return this.membershipService.addMember(familyId, dto);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser, @Param('familyId') familyId: string) {
    await this.authorizationService.assertFamilyMember(user.userId, familyId);
    return this.membershipService.findAll(familyId);
  }
}
