import { z } from 'zod';
import { ICEBREAKER_FLAVOURS } from '../../common/enums';

const UpdateIcebreakerPromptSchema = z.object({
  text: z.string().min(1).max(500),
  order: z.number().int().min(0).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
});

export const UpdateIcebreakerTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  flavour: z
    .enum([
      ICEBREAKER_FLAVOURS.Fun,
      ICEBREAKER_FLAVOURS.Professional,
      ICEBREAKER_FLAVOURS.Creative,
    ])
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  prompts: z.array(UpdateIcebreakerPromptSchema).min(1).max(50).optional(),
});

export type UpdateIcebreakerTemplateBody = z.infer<
  typeof UpdateIcebreakerTemplateSchema
>;
