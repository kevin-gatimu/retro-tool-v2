import { BadRequestException } from '@nestjs/common';
import { STANDUP_CADENCES } from '../common/enums';
import type { Standup } from './schema';

/**
 * Pure date/schedule helpers for standups — no DB or service state. Split out
 * of StandupsService so the scheduling maths can be reused by the query, entry,
 * submission, and report services without duplicating the cadence rules.
 */

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseDate(dateStr: string): Date {
  if (!DATE_PATTERN.test(dateStr)) {
    throw new BadRequestException('Date must be in YYYY-MM-DD format');
  }
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return parsed;
}

export function startOfIsoWeek(input: Date): Date {
  const date = new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
  );
  const day = date.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

export function isScheduledDay(standup: Standup, dateStr: string): boolean {
  const target = parseDate(dateStr);

  // One-time standups occur only on the day they were created.
  if (standup.cadence === STANDUP_CADENCES.Once) {
    return dateStr === standup.createdAt.toISOString().slice(0, 10);
  }

  const dayCode = DAY_CODES[target.getUTCDay()];
  const scheduledDays = standup.scheduleDays
    .split(',')
    .map((day) => day.trim())
    .filter(Boolean);

  if (!scheduledDays.includes(dayCode)) return false;

  if (standup.cadence === STANDUP_CADENCES.Fortnightly) {
    // Anchor fortnights to the week the standup was created (Monday-based).
    const anchor = startOfIsoWeek(standup.createdAt);
    const targetWeek = startOfIsoWeek(target);
    const weeksBetween = Math.round(
      (targetWeek.getTime() - anchor.getTime()) / (7 * MS_PER_DAY),
    );
    return weeksBetween % 2 === 0;
  }

  return true;
}

export function assertSubmittableDate(dateStr: string): void {
  const target = parseDate(dateStr);
  // Allow up to one day ahead of server UTC time so clients in timezones
  // ahead of the server can still submit for their local "today".
  const maxAllowed = Date.now() + MS_PER_DAY;
  if (target.getTime() > maxAllowed) {
    throw new BadRequestException(
      'You can only submit updates for today or past dates',
    );
  }
}

export function formatReportDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
