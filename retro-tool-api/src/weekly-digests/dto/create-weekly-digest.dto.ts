import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const createWeeklyDigestSchema = z.object({
  teamId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6).default(1),
  hourOfDay: z.number().int().min(0).max(23).default(9),
  timezone: z.string().default('UTC'),
  includeMetrics: z.boolean().default(true),
  includeActionItems: z.boolean().default(true),
  includeUpcomingRetros: z.boolean().default(true),
});

export type CreateWeeklyDigestDto = z.infer<typeof createWeeklyDigestSchema>;

export class CreateWeeklyDigestDtoClass {
  @ApiProperty({ description: 'Team ID' })
  teamId: string;

  @ApiPropertyOptional({
    description: 'Day of the week (0=Sun … 6=Sat)',
    minimum: 0,
    maximum: 6,
    default: 1,
  })
  dayOfWeek?: number;

  @ApiPropertyOptional({
    description: 'Hour of the day in 24h format (0–23)',
    minimum: 0,
    maximum: 23,
    default: 9,
  })
  hourOfDay?: number;

  @ApiPropertyOptional({ description: 'IANA timezone', default: 'UTC' })
  timezone?: string;

  @ApiPropertyOptional({ description: 'Include team metrics', default: true })
  includeMetrics?: boolean;

  @ApiPropertyOptional({ description: 'Include action items', default: true })
  includeActionItems?: boolean;

  @ApiPropertyOptional({
    description: 'Include upcoming retros',
    default: true,
  })
  includeUpcomingRetros?: boolean;
}
