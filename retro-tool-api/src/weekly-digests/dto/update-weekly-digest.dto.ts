import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const updateWeeklyDigestSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  hourOfDay: z.number().int().min(0).max(23).optional(),
  timezone: z.string().optional(),
  includeMetrics: z.boolean().optional(),
  includeActionItems: z.boolean().optional(),
  includeUpcomingRetros: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWeeklyDigestDto = z.infer<typeof updateWeeklyDigestSchema>;

export class UpdateWeeklyDigestDtoClass {
  @ApiPropertyOptional({
    description: 'Day of the week (0=Sun … 6=Sat)',
    minimum: 0,
    maximum: 6,
  })
  dayOfWeek?: number;

  @ApiPropertyOptional({
    description: 'Hour of the day in 24h format (0–23)',
    minimum: 0,
    maximum: 23,
  })
  hourOfDay?: number;

  @ApiPropertyOptional({ description: 'IANA timezone' })
  timezone?: string;

  @ApiPropertyOptional({ description: 'Include team metrics' })
  includeMetrics?: boolean;

  @ApiPropertyOptional({ description: 'Include action items' })
  includeActionItems?: boolean;

  @ApiPropertyOptional({ description: 'Include upcoming retros' })
  includeUpcomingRetros?: boolean;

  @ApiPropertyOptional({ description: 'Whether the digest is active' })
  isActive?: boolean;
}
