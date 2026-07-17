import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ACTION_ITEM_STATUSES,
  type TActionItemStatus,
} from '../../common/enums';

export const createActionItemSchema = z.object({
  retroId: z.string().min(1),
  cardId: z.string().min(1).optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  assigneeId: z.string().min(1).optional(),
  status: z
    .enum(Object.values(ACTION_ITEM_STATUSES) as [string, ...string[]])
    .default(ACTION_ITEM_STATUSES.Pending),
  dueDate: z.iso.datetime().optional(),
});

export type CreateActionItemDto = z.infer<typeof createActionItemSchema>;

export class CreateActionItemDtoClass {
  @ApiProperty({ description: 'Retrospective ID' })
  retroId: string;

  @ApiPropertyOptional({ description: 'Card ID to associate with' })
  cardId?: string;

  @ApiProperty({ description: 'Action item title' })
  title: string;

  @ApiPropertyOptional({ description: 'Detailed description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Assignee user ID' })
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Status',
    enum: Object.values(ACTION_ITEM_STATUSES),
    default: ACTION_ITEM_STATUSES.Pending,
  })
  status?: TActionItemStatus;

  @ApiPropertyOptional({ description: 'Due date (ISO 8601)' })
  dueDate?: string;
}
