import { MemberRole } from '@workspace/types';

export interface AuthenticatedUser {
  userId: string;
  familyId: string | null;
  role: MemberRole | null;
}
