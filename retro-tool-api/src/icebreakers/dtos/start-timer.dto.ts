import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const StartTimerSchema = z.object({
  duration: z.number().int().positive().max(3600),
});

export type StartTimerDto = z.infer<typeof StartTimerSchema>;

export class IcebreakerStartTimerBody {
  @ApiProperty({ example: 60, description: 'Countdown duration in seconds' })
  duration: number;
}
