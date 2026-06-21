import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AddMemberDto } from './dto/add-member.dto';
import { MembershipService } from './membership.service';

@Controller('families/:familyId/members')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  // TODO M2: guard with assertFamilyParent — only a PARENT can add members
  @Post()
  addMember(@Param('familyId') familyId: string, @Body() dto: AddMemberDto) {
    return this.membershipService.addMember(familyId, dto);
  }

  // TODO M2: guard with assertFamilyMember — only family members can list members
  @Get()
  findAll(@Param('familyId') familyId: string) {
    return this.membershipService.findAll(familyId);
  }
}
