import { IsIn, IsString } from 'class-validator';
import { ALLOWED_CONTENT_TYPES } from '../s3.service';

export class ConfirmAttachmentDto {
  /** The S3 key returned by the presign endpoint. */
  @IsString()
  s3Key!: string;

  @IsString()
  @IsIn([...ALLOWED_CONTENT_TYPES], {
    message: `contentType must be one of: ${[...ALLOWED_CONTENT_TYPES].join(', ')}`,
  })
  contentType!: string;
}
