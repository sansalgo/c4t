import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuthorizationService } from '../common/authorization.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { RemindersService } from './reminders.service';

// Reminders are child-only in v1: a child manages reminders on their own assigned tasks.
@Controller('families/:familyId/tasks/:taskId/reminders')
export class RemindersController {
  constructor(
    private readonly remindersService: RemindersService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateReminderDto,
  ) {
    await this.authorizationService.assertFamilyMember(user.userId, familyId);
    return this.remindersService.create(taskId, user.userId, dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.authorizationService.assertFamilyMember(user.userId, familyId);
    return this.remindersService.findAll(taskId, user.userId);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
  ) {
    await this.authorizationService.assertFamilyMember(user.userId, familyId);
    return this.remindersService.remove(taskId, id, user.userId);
  }
}
