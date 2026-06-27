export const RECURRENCE_QUEUE = 'recurrence';
export const REMINDERS_QUEUE = 'reminders';

export const RecurrenceJobs = {
  MATERIALIZE_NEXT: 'materialize-next',
  DAILY_SCAN: 'daily-scan',
} as const;

export const ReminderJobs = {
  DISPATCH: 'dispatch',
} as const;
