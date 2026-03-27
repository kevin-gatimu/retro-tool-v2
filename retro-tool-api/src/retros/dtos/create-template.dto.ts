import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const templateColumnSchema = z.object({
  name: z.string().min(1).max(255),
  emoji: z.string().max(100).optional(),
  prompt: z.string().max(2000).optional(),
  order: z.number().int().min(0).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  organizationId: z.string().min(1).optional(),
  columns: z.array(templateColumnSchema).min(1),
});

export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;

export class CreateTemplateDtoClass {
  @ApiProperty({ description: 'Template name', maxLength: 255 })
  name: string;

  @ApiPropertyOptional({ description: 'Template description', maxLength: 2000 })
  description?: string;

  @ApiPropertyOptional({
    description: 'Organization ID for org-scoped templates',
  })
  organizationId?: string;

  @ApiProperty({
    description: 'Template columns in display order',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        emoji: { type: 'string', nullable: true },
        prompt: { type: 'string', nullable: true },
        order: { type: 'number', nullable: true },
      },
      required: ['name'],
    },
  })
  columns: Array<{
    name: string;
    emoji?: string;
    prompt?: string;
    order?: number;
  }>;
}
