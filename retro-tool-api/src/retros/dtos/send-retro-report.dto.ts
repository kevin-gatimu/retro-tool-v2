import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const sendRetroReportSchema = z.object({
  recipients: z.array(z.email()).max(50).optional(),
});

export type SendRetroReportDto = z.infer<typeof sendRetroReportSchema>;

export class SendRetroReportDtoClass {
  @ApiProperty({
    description:
      'Email addresses to send to. Omit to send to all team members.',
    required: false,
    type: [String],
    example: ['user@example.com'],
  })
  recipients?: string[];
}
