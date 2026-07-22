import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const sendStandupReportSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  recipients: z.array(z.email()).max(100).optional(),
});
export type SendStandupReportDto = z.infer<typeof sendStandupReportSchema>;

export class SendStandupReportDtoClass {
  @ApiPropertyOptional({
    description: 'Standup day to report on (YYYY-MM-DD). Defaults to today.',
  })
  date?: string;

  @ApiPropertyOptional({
    description:
      'Email addresses to send to. Omit to send to all team members.',
    type: [String],
    example: ['user@example.com'],
  })
  recipients?: string[];
}
