import { IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { ALLOWED_CONTENT_TYPES } from '../s3.service';

export class PresignRequestDto {
  @IsString()
  @IsIn([...ALLOWED_CONTENT_TYPES], {
    message: `contentType must be one of: ${[...ALLOWED_CONTENT_TYPES].join(', ')}`,
  })
  contentType!: string;

  /** Declared file size in bytes — validated against the configured limit. */
  @IsInt()
  @Min(1)
  @Max(104_857_600) // hard cap: 100 MB (env S3_MAX_SIZE_BYTES may be tighter)
  sizeBytes!: number;
}
