import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';
import { ICEBREAKER_PROMPT_DECISIONS } from '../../common/enums';

export const SwipePromptSchema = z.object({
  decision: z.enum([
    ICEBREAKER_PROMPT_DECISIONS.Kept,
    ICEBREAKER_PROMPT_DECISIONS.Skipped,
  ]),
  sessionPromptId: z.string().min(1),
});

export type SwipePromptDto = z.infer<typeof SwipePromptSchema>;

export class SwipePromptBody {
  @ApiProperty({ example: 'kept', enum: ['kept', 'skipped'] })
  decision: string;

  @ApiProperty({ example: '1a6c03dd-c16c-45de-90cb-6238438ae540' })
  sessionPromptId: string;
}
