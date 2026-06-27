import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuthorizationService } from '../common/authorization.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { RewardsService } from './rewards.service';

@Controller('families/:familyId/rewards')
export class RewardsController {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Body() dto: CreateRewardDto,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.rewardsService.create(familyId, user.userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
  ) {
    // Both parents and children can list rewards; the service filters by role.
    if (user.familyId !== familyId) {
      this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    }
    return this.rewardsService.findAll(familyId, user.role!);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRewardDto,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.rewardsService.update(familyId, id, dto);
  }

  @Delete(':id')
  deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.rewardsService.deactivate(familyId, id);
  }
}
