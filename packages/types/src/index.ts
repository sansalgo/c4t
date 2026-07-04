export const MemberRole = {
  PARENT: 'PARENT',
  CHILD: 'CHILD',
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const TaskStatus = {
  OPEN: 'OPEN',
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

export const LedgerSourceType = {
  TASK: 'TASK',
  REDEMPTION: 'REDEMPTION',
  MANUAL_ADJUST: 'MANUAL_ADJUST',
} as const;
export type LedgerSourceType = (typeof LedgerSourceType)[keyof typeof LedgerSourceType];

export const ReminderChannel = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  PUSH: 'PUSH',
} as const;
export type ReminderChannel = (typeof ReminderChannel)[keyof typeof ReminderChannel];
