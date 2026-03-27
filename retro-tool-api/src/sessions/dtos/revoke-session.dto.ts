import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const revokeSessionSchema = z.object({
  token: z.string().min(1),
});

export type RevokeSessionDto = z.infer<typeof revokeSessionSchema>;

export class RevokeSessionDtoClass {
  @ApiProperty({ description: 'Session token to revoke' })
  token: string;
}
