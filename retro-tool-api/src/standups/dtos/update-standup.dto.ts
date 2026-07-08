import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  STANDUP_CADENCES,
  STANDUP_SCHEDULE_DAYS,
  type TStandupCadence,
} from '../../common/enums';
import { standupQuestionInputSchema } from './create-standup.dto';

const scheduleDayEnum = z.enum(
  Object.values(STANDUP_SCHEDULE_DAYS) as [string, ...string[]],
);

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  message: 'Time must be in HH:MM format',
});

export const updateStandupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  cadence: z
    .enum(Object.values(STANDUP_CADENCES) as [string, ...string[]])
    .optional(),
  scheduleDays: z.array(scheduleDayEnum).min(1).max(7).optional(),
  startTime: timeString.optional(),
  endTime: timeString.optional(),
  isActive: z.boolean().optional(),
  questions: z.array(standupQuestionInputSchema).min(1).max(10).optional(),
});
export type UpdateStandupDto = z.infer<typeof updateStandupSchema>;

export class UpdateStandupDtoClass {
  @ApiPropertyOptional({ description: 'Standup name', maxLength: 255 })
  name?: string;

  @ApiPropertyOptional({
    description: 'Cadence',
    enum: Object.values(STANDUP_CADENCES),
  })
  cadence?: TStandupCadence;

  @ApiPropertyOptional({ description: 'Schedule days', type: [String] })
  scheduleDays?: string[];

  @ApiPropertyOptional({
    description: 'Start time (HH:MM, 24h)',
    example: '14:00',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description: 'End time (HH:MM, 24h)',
    example: '14:30',
  })
  endTime?: string;

  @ApiPropertyOptional({ description: 'Whether the standup is active' })
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'Full replacement list of questions. Existing questions keep their id.',
  })
  questions?: Array<{
    id?: string;
    prompt: string;
    color?: string;
    isRequired?: boolean;
  }>;
}
