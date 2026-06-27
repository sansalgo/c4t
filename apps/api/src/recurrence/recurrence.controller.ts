import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuthorizationService } from '../common/authorization.service';
import { CreateRecurrenceRuleDto } from './dto/create-recurrence-rule.dto';
import { UpdateRecurrenceRuleDto } from './dto/update-recurrence-rule.dto';
import { RecurrenceService } from './recurrence.service';

@Controller('families/:familyId/recurrence-rules')
export class RecurrenceController {
  constructor(
    private readonly recurrenceService: RecurrenceService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Body() dto: CreateRecurrenceRuleDto,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.recurrenceService.create(familyId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Param('familyId') familyId: string) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.recurrenceService.findAll(familyId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.recurrenceService.findOne(familyId, id);
  }

  // Only endAt is patchable — the rule string and template are immutable after creation.
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRecurrenceRuleDto,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.recurrenceService.update(familyId, id, dto);
  }
}
