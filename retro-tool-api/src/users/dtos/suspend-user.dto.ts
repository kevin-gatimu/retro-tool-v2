import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const suspendUserSchema = z.object({
  reason: z.string().optional(),
});

export type SuspendUserDto = z.infer<typeof suspendUserSchema>;

export class SuspendUserDtoClass {
  @ApiPropertyOptional({ description: 'Reason for suspension' })
  reason?: string;
}
