import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

const templateColumnSchema = z.object({
  name: z.string().min(1).max(255),
  emoji: z.string().max(100).optional(),
  prompt: z.string().max(2000).optional(),
  order: z.number().int().min(0).optional(),
});

export const updateTemplateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    organizationId: z.string().min(1).optional(),
    columns: z.array(templateColumnSchema).min(1).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.organizationId !== undefined ||
      value.columns !== undefined,
    {
      message: 'At least one field must be provided',
    },
  );

export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;

export class UpdateTemplateDtoClass {
  @ApiPropertyOptional({ description: 'Template name', maxLength: 255 })
  name?: string;

  @ApiPropertyOptional({ description: 'Template description', maxLength: 2000 })
  description?: string;

  @ApiPropertyOptional({
    description: 'Organization ID for org-scoped templates',
  })
  organizationId?: string;

  @ApiPropertyOptional({
    description: 'Replace template columns with this ordered list',
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
  columns?: Array<{
    name: string;
    emoji?: string;
    prompt?: string;
    order?: number;
  }>;
}
