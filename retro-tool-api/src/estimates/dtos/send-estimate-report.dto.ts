import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const sendEstimateReportSchema = z.object({
  recipients: z.array(z.string().email()).max(50).optional(),
});

export type SendEstimateReportDto = z.infer<typeof sendEstimateReportSchema>;

export class SendEstimateReportDtoClass {
  @ApiProperty({
    description:
      'Email addresses to send to. Omit to send to all team members.',
    required: false,
    type: [String],
    example: ['user@example.com'],
  })
  recipients?: string[];
}
