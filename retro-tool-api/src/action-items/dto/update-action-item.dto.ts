import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const updateActionItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  assigneeId: z.string().min(1).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  dueDate: z.string().datetime().optional(),
});

export type UpdateActionItemDto = z.infer<typeof updateActionItemSchema>;

export class UpdateActionItemDtoClass {
  @ApiPropertyOptional({ description: 'Action item title' })
  title?: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Assignee user ID' })
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: ['pending', 'in_progress', 'completed'],
  })
  status?: 'pending' | 'in_progress' | 'completed';

  @ApiPropertyOptional({ description: 'Due date (ISO 8601)' })
  dueDate?: string;
}
