import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AuthorizationService } from '../common/authorization.service';
import { AttachmentsService } from './attachments.service';
import { ConfirmAttachmentDto } from './dto/confirm-attachment.dto';
import { PresignRequestDto } from './dto/presign-request.dto';

@Controller('families/:familyId/tasks/:taskId/attachments')
export class AttachmentsController {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  /** Step 1 — child requests a presigned S3 PUT URL. */
  @Post('presign')
  async presign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
    @Body() dto: PresignRequestDto,
  ) {
    await this.authorizationService.assertFamilyMember(user.userId, familyId);
    return this.attachmentsService.presign(familyId, taskId, user.userId, dto);
  }

  /** Step 2 — child confirms the upload by posting the returned key. */
  @Post()
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
    @Body() dto: ConfirmAttachmentDto,
  ) {
    await this.authorizationService.assertFamilyMember(user.userId, familyId);
    return this.attachmentsService.confirm(familyId, taskId, user.userId, dto);
  }

  /** List attachments for a task — metadata only, no raw keys. */
  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.authorizationService.assertFamilyMember(user.userId, familyId);
    return this.attachmentsService.findAll(familyId, taskId);
  }

  /** Get a time-limited presigned download URL for one attachment. */
  @Get(':id/url')
  async getDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
  ) {
    await this.authorizationService.assertFamilyMember(user.userId, familyId);
    return this.attachmentsService.getDownloadUrl(familyId, taskId, id);
  }

  /** Delete an attachment — uploader or any parent in the family. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('familyId') familyId: string,
    @Param('taskId') taskId: string,
    @Param('id') id: string,
  ) {
    await this.authorizationService.assertFamilyMember(user.userId, familyId);
    await this.attachmentsService.remove(familyId, taskId, id, user.userId, user.role!);
  }
}
