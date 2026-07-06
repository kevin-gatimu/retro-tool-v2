import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  STANDUP_CADENCES,
  STANDUP_SCHEDULE_DAYS,
  type TStandupCadence,
} from '../../common/enums';

const scheduleDayEnum = z.enum(
  Object.values(STANDUP_SCHEDULE_DAYS) as [string, ...string[]],
);

// Local 24h wall-clock time, "HH:MM".
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  message: 'Time must be in HH:MM format',
});

export const standupQuestionInputSchema = z.object({
  id: z.string().optional(),
  prompt: z.string().min(1).max(500),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  isRequired: z.boolean().default(true),
});

export const createStandupSchema = z
  .object({
    name: z.string().min(1).max(255),
    teamId: z.string().min(1),
    cadence: z
      .enum(Object.values(STANDUP_CADENCES) as [string, ...string[]])
      .default(STANDUP_CADENCES.Daily),
    // Not needed for one-time standups; required for recurring cadences.
    scheduleDays: z.array(scheduleDayEnum).max(7).default([]),
    // Scheduled time-of-day (required for new standups).
    startTime: timeString,
    endTime: timeString,
    questions: z.array(standupQuestionInputSchema).min(1).max(10),
  })
  .refine(
    (value) =>
      value.cadence === STANDUP_CADENCES.Once || value.scheduleDays.length > 0,
    { message: 'scheduleDays is required for recurring standups' },
  )
  .refine((value) => value.endTime > value.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });
export type CreateStandupDto = z.infer<typeof createStandupSchema>;

export class CreateStandupDtoClass {
  @ApiProperty({ description: 'Standup name', maxLength: 255 })
  name: string;

  @ApiProperty({ description: 'Team ID' })
  teamId: string;

  @ApiPropertyOptional({
    description: 'Cadence',
    enum: Object.values(STANDUP_CADENCES),
    default: STANDUP_CADENCES.Daily,
  })
  cadence?: TStandupCadence;

  @ApiProperty({
    description: "Schedule days, e.g. ['MON','TUE','WED','THU','FRI']",
    type: [String],
  })
  scheduleDays: string[];

  @ApiProperty({ description: 'Start time (HH:MM, 24h)', example: '14:00' })
  startTime: string;

  @ApiProperty({ description: 'End time (HH:MM, 24h)', example: '14:30' })
  endTime: string;

  @ApiProperty({
    description: 'Custom questions',
    example: [
      { prompt: 'What did you complete yesterday?', color: '#3b82f6' },
      { prompt: 'What are you working on today?', color: '#22c55e' },
      { prompt: 'What blockers do you have?', color: '#f59e0b' },
    ],
  })
  questions: Array<{ prompt: string; color?: string; isRequired?: boolean }>;
}
