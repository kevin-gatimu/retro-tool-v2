import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BULK_UPDATE_STATUSES, TUserStatus } from '../../common/enums';

export const bulkUpdateStatusSchema = z.object({
  userIds: z.array(z.string()).min(1),
  status: z.enum(BULK_UPDATE_STATUSES),
  reason: z.string().optional(),
});

export type BulkUpdateStatusDto = z.infer<typeof bulkUpdateStatusSchema>;

export class BulkUpdateStatusDtoClass {
  @ApiProperty({ description: 'Array of user IDs to update', type: [String] })
  userIds: string[];

  @ApiProperty({
    description: 'New status to apply',
    enum: BULK_UPDATE_STATUSES,
  })
  status: TUserStatus;

  @ApiPropertyOptional({ description: 'Reason for the status change' })
  reason?: string;
}
