import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const createRetroReminderSchema = z.object({
  teamId: z.string().min(1),
  retroId: z.string().min(1).optional(),
  type: z.enum(['before_retro', 'after_retro', 'custom']),
  schedule: z.string().min(1),
  message: z.string().optional(),
});

export type CreateRetroReminderDto = z.infer<typeof createRetroReminderSchema>;

export class CreateRetroReminderDtoClass {
  @ApiProperty({ description: 'Team ID' })
  teamId: string;

  @ApiPropertyOptional({
    description: 'Retro ID to associate this reminder with',
  })
  retroId?: string;

  @ApiProperty({
    description: 'Reminder type',
    enum: ['before_retro', 'after_retro', 'custom'],
  })
  type: 'before_retro' | 'after_retro' | 'custom';

  @ApiProperty({ description: 'Cron expression or schedule string' })
  schedule: string;

  @ApiPropertyOptional({ description: 'Custom reminder message' })
  message?: string;
}
