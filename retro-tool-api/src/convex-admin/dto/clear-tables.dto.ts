import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const clearTablesSchema = z.object({
  tableNames: z.array(z.string().min(1).max(128)).min(1),
});

export type ClearTablesDto = z.infer<typeof clearTablesSchema>;

export class ClearTablesDtoClass {
  @ApiProperty({
    example: ['livePresence', 'liveTyping', 'liveReadyStatus'],
    description: 'Convex table names to clear immediately',
  })
  tableNames: string[];
}
