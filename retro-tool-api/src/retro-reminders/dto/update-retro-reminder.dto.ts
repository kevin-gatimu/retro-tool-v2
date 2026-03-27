import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const updateRetroReminderSchema = z.object({
  type: z.enum(['before_retro', 'after_retro', 'custom']).optional(),
  schedule: z.string().min(1).optional(),
  message: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRetroReminderDto = z.infer<typeof updateRetroReminderSchema>;

export class UpdateRetroReminderDtoClass {
  @ApiPropertyOptional({
    description: 'Reminder type',
    enum: ['before_retro', 'after_retro', 'custom'],
  })
  type?: 'before_retro' | 'after_retro' | 'custom';

  @ApiPropertyOptional({ description: 'Cron expression or schedule string' })
  schedule?: string;

  @ApiPropertyOptional({ description: 'Custom reminder message' })
  message?: string;

  @ApiPropertyOptional({ description: 'Whether the reminder is active' })
  isActive?: boolean;
}
