import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuthorizationService } from '../common/authorization.service';
import { AdjustLedgerDto } from './dto/adjust-ledger.dto';
import { LedgerService } from './ledger.service';

@Controller('families/:familyId/children/:childId')
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get('balance')
  async getBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('childId') childId: string,
  ) {
    this.authorizationService.assertCanAccessChildData(user, familyId, childId);
    const balance = await this.ledgerService.getBalance(familyId, childId);
    return { balance };
  }

  @Get('ledger')
  async listEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('childId') childId: string,
  ) {
    this.authorizationService.assertCanAccessChildData(user, familyId, childId);
    return this.ledgerService.listEntries(familyId, childId);
  }

  @Post('adjustments')
  async adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('childId') childId: string,
    @Body() dto: AdjustLedgerDto,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.ledgerService.adjust(familyId, childId, user.userId, dto.amount, dto.note);
  }
}
