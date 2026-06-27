import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuthorizationService } from '../common/authorization.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { FamilyService } from './family.service';

@Controller('families')
export class FamilyController {
  constructor(
    private readonly familyService: FamilyService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFamilyDto) {
    return this.familyService.create(user.userId, dto);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.authorizationService.assertFamilyMember(user.userId, id);
    return this.familyService.findOne(id);
  }
}
