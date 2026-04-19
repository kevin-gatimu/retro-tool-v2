import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── System-level (built-in role management) ──────────────────────────────────

export const createTeamRoleSchema = z.object({
  name: z.string().min(1).max(255),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});
export type CreateTeamRoleDto = z.infer<typeof createTeamRoleSchema>;

export class CreateTeamRoleDtoClass {
  @ApiProperty({ description: 'Role name' })
  name: string;

  @ApiPropertyOptional({ description: 'Display order', default: 0 })
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether the role is active',
    default: true,
  })
  isActive?: boolean;
}

export const updateTeamRoleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTeamRoleDto = z.infer<typeof updateTeamRoleSchema>;

export class UpdateTeamRoleDtoClass {
  @ApiPropertyOptional({ description: 'Role name' })
  name?: string;

  @ApiPropertyOptional({ description: 'Display order' })
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the role is active' })
  isActive?: boolean;
}

// ── Org-level (custom role management) ───────────────────────────────────────

export const createOrgTeamRoleSchema = z.object({
  name: z.string().min(1).max(255),
  sortOrder: z.number().int().min(0).optional().default(0),
});
export type CreateOrgTeamRoleDto = z.infer<typeof createOrgTeamRoleSchema>;

export class CreateOrgTeamRoleDtoClass {
  @ApiProperty({ description: 'Role name' })
  name: string;

  @ApiPropertyOptional({ description: 'Display order', default: 0 })
  sortOrder?: number;
}

// ── Org-level activation toggle ───────────────────────────────────────────────

export const toggleRoleActivationSchema = z.object({
  isActive: z.boolean(),
});
export type ToggleRoleActivationDto = z.infer<
  typeof toggleRoleActivationSchema
>;

export class ToggleRoleActivationDtoClass {
  @ApiProperty({ description: 'Whether the role is active for this org' })
  isActive: boolean;
}
