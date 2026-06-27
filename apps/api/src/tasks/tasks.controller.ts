import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { MemberRole } from '@workspace/types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuthorizationService } from '../common/authorization.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('families/:familyId/tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  // ── M4: CRUD ──────────────────────────────────────────────────────────────

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Body() dto: CreateTaskDto,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.tasksService.create(familyId, user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Param('familyId') familyId: string) {
    if (user.familyId !== familyId) {
      this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    }
    return this.tasksService.findAll(familyId, user.role!, user.userId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    if (user.familyId !== familyId) {
      this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    }
    return this.tasksService.findOne(familyId, id, user.role!, user.userId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.tasksService.update(familyId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.tasksService.remove(familyId, id);
  }

  // ── M5: Lifecycle transitions ─────────────────────────────────────────────

  // Child submits their completed task.
  // ASSIGNED → PENDING_REVIEW (requiresReview) or ASSIGNED → COMPLETED + EARN
  @Post(':id/submit')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    if (user.familyId !== familyId || user.role !== MemberRole.CHILD) {
      throw new ForbiddenException('Only the assigned child can submit a task');
    }
    return this.tasksService.submit(familyId, id, user.userId);
  }

  // Parent approves a task under review.
  // PENDING_REVIEW → COMPLETED + EARN (atomic, double-credit-safe)
  @Post(':id/approve')
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.tasksService.approve(familyId, id, user.userId);
  }

  // Parent rejects a task under review, returning it to ASSIGNED with an optional note.
  // PENDING_REVIEW → ASSIGNED  (no ledger change)
  @Post(':id/reject')
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('id') id: string,
    @Body() dto: RejectTaskDto,
  ) {
    this.authorizationService.assertFamilyParentFromJwt(user, familyId);
    return this.tasksService.reject(familyId, id, dto);
  }
}
