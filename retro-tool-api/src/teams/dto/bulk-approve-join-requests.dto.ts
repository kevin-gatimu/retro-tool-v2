import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const bulkApproveJoinRequestsSchema = z.object({
  requestIds: z.array(z.uuid()).min(1).max(200),
});

export type BulkApproveJoinRequestsDto = z.infer<
  typeof bulkApproveJoinRequestsSchema
>;

export class BulkApproveJoinRequestsDtoClass {
  @ApiProperty({
    description: 'Join request IDs to approve',
    type: [String],
  })
  requestIds: string[];
}
