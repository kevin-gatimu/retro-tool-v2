import { z } from 'zod';

const UpdateEstimateTemplateValueSchema = z.object({
  label: z.string().min(1).max(20),
  value: z.string().min(1).max(20),
  order: z.number().int().min(0).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  description: z.string().max(500).optional().nullable(),
});

export const UpdateEstimateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .nullable(),
  values: z.array(UpdateEstimateTemplateValueSchema).min(1).max(30).optional(),
});

export type UpdateEstimateTemplateBody = z.infer<
  typeof UpdateEstimateTemplateSchema
>;
