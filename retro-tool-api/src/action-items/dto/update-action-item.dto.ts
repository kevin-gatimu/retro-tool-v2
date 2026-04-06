import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ACTION_ITEM_STATUSES,
  type TActionItemStatus,
} from '../../common/enums';

export const updateActionItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  assigneeId: z.string().min(1).optional(),
  status: z
    .enum(Object.values(ACTION_ITEM_STATUSES) as [string, ...string[]])
    .optional(),
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
    enum: Object.values(ACTION_ITEM_STATUSES),
  })
  status?: TActionItemStatus;

  @ApiPropertyOptional({ description: 'Due date (ISO 8601)' })
  dueDate?: string;
}
