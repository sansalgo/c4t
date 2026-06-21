export const MemberRole = {
  PARENT: 'PARENT',
  CHILD: 'CHILD',
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const TaskStatus = {
  ASSIGNED: 'ASSIGNED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  COMPLETED: 'COMPLETED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const LedgerEntryType = {
  EARN: 'EARN',
  SPEND: 'SPEND',
  REVERSAL: 'REVERSAL',
  ADJUST: 'ADJUST',
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

export const RedemptionStatus = {
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;
export type RedemptionStatus = (typeof RedemptionStatus)[keyof typeof RedemptionStatus];
