import { z } from 'zod';

const EstimateTemplateValueSchema = z.object({
  label: z.string().min(1).max(20),
  value: z.string().min(1).max(20),
  order: z.number().int().min(0).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  description: z.string().max(500).optional(),
});

export const CreateEstimateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  organizationId: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  values: z.array(EstimateTemplateValueSchema).min(1).max(30),
});

export type CreateEstimateTemplateBody = z.infer<
  typeof CreateEstimateTemplateSchema
>;
