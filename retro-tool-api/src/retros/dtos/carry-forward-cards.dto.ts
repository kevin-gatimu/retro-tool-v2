import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const carryForwardCardsSchema = z.object({
  cardIds: z.array(z.string().min(1)).max(200),
});
export type CarryForwardCardsDto = z.infer<typeof carryForwardCardsSchema>;

export class CarryForwardCardsDtoClass {
  @ApiProperty({
    description: 'IDs of undiscussed cards to carry forward as action items',
    type: [String],
  })
  cardIds: string[];
}
