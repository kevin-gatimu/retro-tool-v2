import { z } from 'zod';
import { ICEBREAKER_FLAVOURS } from '../../common/enums';

const IcebreakerPromptSchema = z.object({
  text: z.string().min(1).max(500),
  order: z.number().int().min(0).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const CreateIcebreakerTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  flavour: z
    .enum([
      ICEBREAKER_FLAVOURS.Fun,
      ICEBREAKER_FLAVOURS.Professional,
      ICEBREAKER_FLAVOURS.Creative,
    ])
    .default(ICEBREAKER_FLAVOURS.Fun),
  organizationId: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  prompts: z.array(IcebreakerPromptSchema).min(1).max(50),
});

export type CreateIcebreakerTemplateBody = z.infer<
  typeof CreateIcebreakerTemplateSchema
>;
