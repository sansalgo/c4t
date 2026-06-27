import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@workspace/types';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmAttachmentDto } from './dto/confirm-attachment.dto';
import { PresignRequestDto } from './dto/presign-request.dto';
import { S3Service } from './s3.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  // ── 1. Request presigned PUT URL ──────────────────────────────────────────

  async presign(
    familyId: string,
    taskId: string,
    userId: string,
    dto: PresignRequestDto,
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    // Size limit enforced here (declared) AND re-checked after upload (actual).
    if (dto.sizeBytes > this.s3.maxSizeBytes) {
      throw new BadRequestException(
        `File size ${dto.sizeBytes} exceeds the ${this.s3.maxSizeBytes}-byte limit`,
      );
    }

    const task = await this.prisma.task.findFirst({ where: { id: taskId, familyId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.assignedToUserId !== userId) {
      throw new ForbiddenException('You can only upload attachments for tasks assigned to you');
    }

    const s3Key = this.s3.generateKey(familyId, taskId, dto.contentType);
    const uploadUrl = await this.s3.createPresignedPutUrl(s3Key, dto.contentType);

    return { uploadUrl, s3Key };
  }

  // ── 2. Confirm upload — verify the file exists in S3, then store the row ──

  async confirm(
    familyId: string,
    taskId: string,
    userId: string,
    dto: ConfirmAttachmentDto,
  ) {
    // Validate key format to prevent path-injection attacks.
    const expectedPrefix = `families/${familyId}/tasks/${taskId}/`;
    if (!dto.s3Key.startsWith(expectedPrefix)) {
      throw new BadRequestException('Invalid s3Key — key does not belong to this task');
    }

    const task = await this.prisma.task.findFirst({ where: { id: taskId, familyId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.assignedToUserId !== userId) {
      throw new ForbiddenException('You can only confirm attachments for tasks assigned to you');
    }

    // Re-check: verify the object actually landed in S3 and read its real size.
    let actualSizeBytes: number;
    try {
      const head = await this.s3.headObject(dto.s3Key);
      actualSizeBytes = head.ContentLength ?? 0;
    } catch (err: any) {
      const status = err?.$metadata?.httpStatusCode;
      if (status === 404 || err?.name === 'NotFound') {
        throw new BadRequestException(
          'File not found in storage — complete the upload before confirming',
        );
      }
      throw new InternalServerErrorException('Could not verify uploaded file');
    }

    // Enforce size limit against the real file (client could lie about declared size).
    if (actualSizeBytes > this.s3.maxSizeBytes) {
      await this.s3.deleteObject(dto.s3Key).catch(() => undefined);
      throw new BadRequestException(
        `Uploaded file (${actualSizeBytes} bytes) exceeds the size limit`,
      );
    }

    return this.prisma.attachment.create({
      data: {
        taskId,
        uploadedByUserId: userId,
        s3Key: dto.s3Key,
        contentType: dto.contentType,
        sizeBytes: actualSizeBytes,
      },
    });
  }

  // ── 3. List attachments for a task ────────────────────────────────────────

  async findAll(familyId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, familyId } });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        taskId: true,
        uploadedByUserId: true,
        contentType: true,
        sizeBytes: true,
        createdAt: true,
        // s3Key intentionally omitted from list — callers get URLs via /url endpoint
      },
    });
  }

  // ── 4. Get a time-limited presigned download URL ──────────────────────────

  async getDownloadUrl(
    familyId: string,
    taskId: string,
    attachmentId: string,
  ): Promise<{ url: string }> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, taskId },
      include: { task: { select: { familyId: true } } },
    });
    if (!attachment || attachment.task.familyId !== familyId) {
      throw new NotFoundException('Attachment not found');
    }

    const url = await this.s3.createPresignedGetUrl(attachment.s3Key);
    return { url };
  }

  // ── 5. Delete attachment ──────────────────────────────────────────────────

  async remove(
    familyId: string,
    taskId: string,
    attachmentId: string,
    actorId: string,
    actorRole: MemberRole,
  ): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, taskId },
      include: { task: { select: { familyId: true } } },
    });
    if (!attachment || attachment.task.familyId !== familyId) {
      throw new NotFoundException('Attachment not found');
    }

    const isOwner = attachment.uploadedByUserId === actorId;
    const isParent = actorRole === MemberRole.PARENT;
    if (!isOwner && !isParent) {
      throw new ForbiddenException('Only the uploader or a parent can delete this attachment');
    }

    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    // Best-effort S3 deletion — if it fails the DB row is already gone.
    await this.s3.deleteObject(attachment.s3Key).catch(() => undefined);
  }
}
