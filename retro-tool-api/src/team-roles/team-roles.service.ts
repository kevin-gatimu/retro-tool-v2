import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, asc, count, eq, isNull, or } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { CommonService } from '../common/common.service';
import { generateId } from 'src/lib/utils';
import { assertPermission, isOrgAdmin } from '../lib/rbac';
import * as teamSchema from '../teams/schema';
import * as orgSchema from '../organizations/schema';
import {
  CreateTeamRoleDto,
  CreateOrgTeamRoleDto,
  UpdateTeamRoleDto,
  ToggleRoleActivationDto,
} from './dto';
import { BUILT_IN_TEAM_ROLES } from '../common/data/built-in-team-roles';

type Database = NodePgDatabase<typeof teamSchema & typeof orgSchema>;

@Injectable()
export class TeamRolesService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly commonService: CommonService,
  ) {}

  // ── System-level (built-in roles) ──────────────────────────────────────────

  async listBuiltInRoles() {
    return this.database
      .select()
      .from(teamSchema.teamRole)
      .where(eq(teamSchema.teamRole.isBuiltIn, true))
      .orderBy(asc(teamSchema.teamRole.sortOrder));
  }

  async createBuiltInRole(userId: string, data: CreateTeamRoleDto) {
    assertPermission(
      await this.commonService.isSystemAdmin(userId),
      'Only system admins can create built-in roles',
    );

    const [created] = await this.database
      .insert(teamSchema.teamRole)
      .values({
        id: generateId(),
        name: data.name,
        isBuiltIn: true,
        orgId: null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

  async updateBuiltInRole(
    userId: string,
    roleId: string,
    data: UpdateTeamRoleDto,
  ) {
    assertPermission(
      await this.commonService.isSystemAdmin(userId),
      'Only system admins can update built-in roles',
    );

    const [role] = await this.database
      .select()
      .from(teamSchema.teamRole)
      .where(
        and(
          eq(teamSchema.teamRole.id, roleId),
          eq(teamSchema.teamRole.isBuiltIn, true),
        ),
      )
      .limit(1);

    if (!role) throw new NotFoundException('Role not found');

    const [updated] = await this.database
      .update(teamSchema.teamRole)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teamSchema.teamRole.id, roleId))
      .returning();

    return updated;
  }

  async deleteBuiltInRole(userId: string, roleId: string) {
    assertPermission(
      await this.commonService.isSystemAdmin(userId),
      'Only system admins can delete built-in roles',
    );

    const [role] = await this.database
      .select()
      .from(teamSchema.teamRole)
      .where(
        and(
          eq(teamSchema.teamRole.id, roleId),
          eq(teamSchema.teamRole.isBuiltIn, true),
        ),
      )
      .limit(1);

    if (!role) throw new NotFoundException('Role not found');

    const [inUse] = await this.database
      .select({ count: count() })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.roleId, roleId));

    if (inUse.count > 0) {
      throw new ConflictException(
        `Cannot delete role — it is assigned to ${inUse.count} team member(s)`,
      );
    }

    const [deleted] = await this.database
      .delete(teamSchema.teamRole)
      .where(eq(teamSchema.teamRole.id, roleId))
      .returning();

    return deleted;
  }

  async seedBuiltInRoles(userId: string) {
    assertPermission(
      await this.commonService.isSystemAdmin(userId),
      'Only system admins can seed built-in roles',
    );

    const existing = await this.database
      .select({ name: teamSchema.teamRole.name })
      .from(teamSchema.teamRole)
      .where(eq(teamSchema.teamRole.isBuiltIn, true));

    const existingNames = new Set(existing.map((r) => r.name));
    const now = new Date();
    let added = 0;

    for (const role of BUILT_IN_TEAM_ROLES) {
      if (existingNames.has(role.name)) continue;
      await this.database.insert(teamSchema.teamRole).values({
        id: generateId(),
        name: role.name,
        isBuiltIn: true,
        orgId: null,
        isActive: true,
        sortOrder: role.sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      added++;
    }

    return {
      message:
        added > 0
          ? `Seeded ${added} built-in role(s)`
          : 'All built-in roles already exist',
      added,
    };
  }

  // ── Org-level ──────────────────────────────────────────────────────────────

  async listOrgRoles(userId: string, orgId: string) {
    const ctx = await this.commonService.buildOrgContext(userId, orgId);
    assertPermission(
      ctx.orgRole !== null || ctx.isSystemAdmin || ctx.isSuperAdmin,
      'You must be a member of this organization',
    );

    const builtInRows = await this.database
      .select({
        role: teamSchema.teamRole,
        config: teamSchema.orgTeamRoleConfig,
      })
      .from(teamSchema.teamRole)
      .leftJoin(
        teamSchema.orgTeamRoleConfig,
        and(
          eq(teamSchema.orgTeamRoleConfig.teamRoleId, teamSchema.teamRole.id),
          eq(teamSchema.orgTeamRoleConfig.orgId, orgId),
        ),
      )
      .where(
        and(
          eq(teamSchema.teamRole.isBuiltIn, true),
          eq(teamSchema.teamRole.isActive, true),
          or(
            isNull(teamSchema.orgTeamRoleConfig.id),
            eq(teamSchema.orgTeamRoleConfig.isActive, true),
          ),
        ),
      )
      .orderBy(asc(teamSchema.teamRole.sortOrder));

    const customRoles = await this.database
      .select()
      .from(teamSchema.teamRole)
      .where(
        and(
          eq(teamSchema.teamRole.orgId, orgId),
          eq(teamSchema.teamRole.isBuiltIn, false),
          eq(teamSchema.teamRole.isActive, true),
        ),
      )
      .orderBy(asc(teamSchema.teamRole.sortOrder));

    return [...builtInRows.map((r) => r.role), ...customRoles];
  }

  async listAllOrgRolesForAdmin(userId: string, orgId: string) {
    const ctx = await this.commonService.buildOrgContext(userId, orgId);
    assertPermission(isOrgAdmin(ctx), 'Only org admins can view role settings');

    const builtInRows = await this.database
      .select({
        role: teamSchema.teamRole,
        config: teamSchema.orgTeamRoleConfig,
      })
      .from(teamSchema.teamRole)
      .leftJoin(
        teamSchema.orgTeamRoleConfig,
        and(
          eq(teamSchema.orgTeamRoleConfig.teamRoleId, teamSchema.teamRole.id),
          eq(teamSchema.orgTeamRoleConfig.orgId, orgId),
        ),
      )
      .where(eq(teamSchema.teamRole.isBuiltIn, true))
      .orderBy(asc(teamSchema.teamRole.sortOrder));

    const customRoles = await this.database
      .select()
      .from(teamSchema.teamRole)
      .where(
        and(
          eq(teamSchema.teamRole.orgId, orgId),
          eq(teamSchema.teamRole.isBuiltIn, false),
        ),
      )
      .orderBy(asc(teamSchema.teamRole.sortOrder));

    return {
      builtIn: builtInRows.map((r) => ({
        ...r.role,
        orgIsActive: r.config ? r.config.isActive : true,
      })),
      custom: customRoles,
    };
  }

  async createOrgCustomRole(
    userId: string,
    orgId: string,
    data: CreateOrgTeamRoleDto,
  ) {
    const ctx = await this.commonService.buildOrgContext(userId, orgId);
    assertPermission(isOrgAdmin(ctx), 'Only org admins can create org roles');

    const [created] = await this.database
      .insert(teamSchema.teamRole)
      .values({
        id: generateId(),
        name: data.name,
        isBuiltIn: false,
        orgId,
        isActive: true,
        sortOrder: data.sortOrder ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return created;
  }

  async updateOrgCustomRole(
    userId: string,
    orgId: string,
    roleId: string,
    data: UpdateTeamRoleDto,
  ) {
    const ctx = await this.commonService.buildOrgContext(userId, orgId);
    assertPermission(isOrgAdmin(ctx), 'Only org admins can update org roles');

    const [role] = await this.database
      .select()
      .from(teamSchema.teamRole)
      .where(
        and(
          eq(teamSchema.teamRole.id, roleId),
          eq(teamSchema.teamRole.orgId, orgId),
          eq(teamSchema.teamRole.isBuiltIn, false),
        ),
      )
      .limit(1);

    if (!role)
      throw new NotFoundException('Custom role not found for this org');

    const [updated] = await this.database
      .update(teamSchema.teamRole)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teamSchema.teamRole.id, roleId))
      .returning();

    return updated;
  }

  async deleteOrgCustomRole(userId: string, orgId: string, roleId: string) {
    const ctx = await this.commonService.buildOrgContext(userId, orgId);
    assertPermission(isOrgAdmin(ctx), 'Only org admins can delete org roles');

    const [role] = await this.database
      .select()
      .from(teamSchema.teamRole)
      .where(
        and(
          eq(teamSchema.teamRole.id, roleId),
          eq(teamSchema.teamRole.orgId, orgId),
          eq(teamSchema.teamRole.isBuiltIn, false),
        ),
      )
      .limit(1);

    if (!role)
      throw new NotFoundException('Custom role not found for this org');

    const [inUse] = await this.database
      .select({ count: count() })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.roleId, roleId));

    if (inUse.count > 0) {
      throw new ConflictException(
        `Cannot delete role — it is assigned to ${inUse.count} team member(s)`,
      );
    }

    const [deleted] = await this.database
      .delete(teamSchema.teamRole)
      .where(eq(teamSchema.teamRole.id, roleId))
      .returning();

    return deleted;
  }

  async toggleBuiltInRoleForOrg(
    userId: string,
    orgId: string,
    roleId: string,
    data: ToggleRoleActivationDto,
  ) {
    const ctx = await this.commonService.buildOrgContext(userId, orgId);
    assertPermission(
      isOrgAdmin(ctx),
      'Only org admins can configure role availability',
    );

    const [role] = await this.database
      .select()
      .from(teamSchema.teamRole)
      .where(
        and(
          eq(teamSchema.teamRole.id, roleId),
          eq(teamSchema.teamRole.isBuiltIn, true),
        ),
      )
      .limit(1);

    if (!role) throw new NotFoundException('Built-in role not found');

    const [upserted] = await this.database
      .insert(teamSchema.orgTeamRoleConfig)
      .values({
        id: generateId(),
        orgId,
        teamRoleId: roleId,
        isActive: data.isActive,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          teamSchema.orgTeamRoleConfig.orgId,
          teamSchema.orgTeamRoleConfig.teamRoleId,
        ],
        set: { isActive: data.isActive },
      })
      .returning();

    return upserted;
  }
}
