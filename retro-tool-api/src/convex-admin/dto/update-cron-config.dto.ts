import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const CRON_REGEX =
  /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;

export const updateCronConfigSchema = z.object({
  schedule: z
    .string()
    .regex(CRON_REGEX, 'schedule must be a valid 5-part cron expression')
    .optional(),
  enabled: z.boolean().optional(),
  tablesToClear: z.array(z.string().min(1).max(128)).optional(),
});

export type UpdateCronConfigDto = z.infer<typeof updateCronConfigSchema>;

export class UpdateCronConfigDtoClass {
  @ApiPropertyOptional({
    example: '0 0 * * 0',
    description: '5-part cron expression',
  })
  schedule?: string;

  @ApiPropertyOptional({ example: true })
  enabled?: boolean;

  @ApiPropertyOptional({
    example: ['liveRetroSessions', 'livePresence'],
    description: 'Convex table names to clear on each cron run',
  })
  tablesToClear?: string[];
}
