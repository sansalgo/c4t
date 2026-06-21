import { IsEnum, IsString } from 'class-validator';
import { MemberRole } from '@workspace/types';

export class AddMemberDto {
  @IsString()
  userId!: string;

  @IsEnum(MemberRole)
  role!: MemberRole;
}
