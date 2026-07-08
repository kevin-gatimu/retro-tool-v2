import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const submitStandupSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        content: z.string().max(5000),
      }),
    )
    .min(1)
    .max(10),
});
export type SubmitStandupDto = z.infer<typeof submitStandupSchema>;

export class SubmitStandupDtoClass {
  @ApiProperty({
    description: 'Per-question answers',
    example: [{ questionId: 'q1', content: 'Shipped the OAuth integration' }],
  })
  answers: Array<{ questionId: string; content: string }>;
}
