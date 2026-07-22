import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const UpdateSessionSchema = z.object({
  name: z.string().min(1).max(255),
});

export type UpdateSessionDto = z.infer<typeof UpdateSessionSchema>;

export class UpdateSessionBody {
  @ApiProperty({ example: 'Monday Standup Warm-up', maxLength: 255 })
  name: string;
}
