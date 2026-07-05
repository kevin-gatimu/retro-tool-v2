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

export const createStandupSchema = z.object({
  name: z.string().min(1).max(255),
  teamId: z.string().min(1),
  cadence: z
    .enum(Object.values(STANDUP_CADENCES) as [string, ...string[]])
    .default(STANDUP_CADENCES.Daily),
  scheduleDays: z.array(scheduleDayEnum).min(1).max(7),
  questions: z.array(standupQuestionInputSchema).min(1).max(10),
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
