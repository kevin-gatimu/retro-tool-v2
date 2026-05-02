import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  eq,
  and,
  or,
  asc,
  desc,
  count,
  inArray,
  ilike,
  sql,
  type SQL,
} from 'drizzle-orm';
import * as orgSchema from './schema';
import * as userSchema from '../auth/schema';
import * as teamSchema from '../teams/schema';
import { generateId } from '../lib/utils';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { BulkSetupOrganizationDto } from './dto/bulk-setup-organization.dto';
import { CommonService } from '../common/common.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  TOrgAssignableRole,
  USER_STATUSES,
} from '../common/enums';

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase<
      typeof orgSchema & typeof userSchema
    >,
    private readonly commonService: CommonService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async isSystemAdmin(userId: string): Promise<boolean> {
    return this.commonService.isSystemAdmin(userId);
  }

  private async isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
    return this.commonService.isOrgAdmin(userId, orgId);
  }

  private async isOrgOwner(userId: string, orgId: string): Promise<boolean> {
    return this.commonService.isOrgOwner(userId, orgId);
  }

  private async attachMemberCounts<T extends { id: string }>(
    organizations: T[],
  ): Promise<Array<T & { memberCount: number }>> {
    if (organizations.length === 0) {
      return [];
    }

    const organizationIds = organizations.map((org) => org.id);
    const counts = await this.database
      .select({
        organizationId: orgSchema.organizationMember.organizationId,
        count: count(),
      })
      .from(orgSchema.organizationMember)
      .where(
        inArray(orgSchema.organizationMember.organizationId, organizationIds),
      )
      .groupBy(orgSchema.organizationMember.organizationId);

    const countsByOrgId = new Map(
      counts.map((entry) => [entry.organizationId, Number(entry.count)]),
    );

    return organizations.map((org) => ({
      ...org,
      memberCount: countsByOrgId.get(org.id) ?? 0,
    }));
  }

  async bulkSetupOrganization(
    callerId: string,
    dto: BulkSetupOrganizationDto,
  ): Promise<{
    org: { id: string; name: string; slug: string };
    memberCount: number;
    teamCount: number;
  }> {
    const callerIsAdmin = await this.isSystemAdmin(callerId);
    if (!callerIsAdmin) {
      throw new ForbiddenException(
        'Only system admins can use the bulk organisation setup',
      );
    }

    return await this.database.transaction(async (tx) => {
      // 1. Check slug uniqueness
      const [existing] = await tx
        .select({ id: orgSchema.organization.id })
        .from(orgSchema.organization)
        .where(eq(orgSchema.organization.slug, dto.slug))
        .limit(1);

      if (existing) {
        throw new ConflictException(
          'An organisation with this slug already exists',
        );
      }

      // 2. Create the organisation row
      const orgId = generateId();
      const [org] = await tx
        .insert(orgSchema.organization)
        .values({
          id: orgId,
          name: dto.name,
          slug: dto.slug,
          logo: dto.logo ?? null,
          ownerId: callerId,
        })
        .returning();

      // 3. Track which user IDs are already members (to avoid duplicates)
      const addedUserIds = new Set<string>();

      // Helper: insert member only once per user
      const insertMember = async (
        userId: string,
        role: (typeof ORG_MEMBER_ROLES)[keyof typeof ORG_MEMBER_ROLES],
      ) => {
        if (addedUserIds.has(userId)) return;
        addedUserIds.add(userId);
        await tx.insert(orgSchema.organizationMember).values({
          id: generateId(),
          organizationId: orgId,
          userId,
          role,
        });
      };

      // 4. Add caller as owner
      await insertMember(callerId, ORG_MEMBER_ROLES.Owner);

      // 5. Add specified owner (if different from caller)
      if (dto.ownerId && dto.ownerId !== callerId) {
        await insertMember(dto.ownerId, ORG_MEMBER_ROLES.Owner);
      }

      // 6. Add admins
      for (const adminId of dto.adminIds ?? []) {
        await insertMember(adminId, ORG_MEMBER_ROLES.Admin);
      }

      // 7. Add members
      for (const memberId of dto.memberIds ?? []) {
        await insertMember(memberId, ORG_MEMBER_ROLES.Member);
      }

      // 8. Create teams
      const seenTeamNames = new Set<string>();
      let teamCount = 0;
      for (const teamInput of dto.teams ?? []) {
        const normalizedName = teamInput.name.trim();
        if (!normalizedName) continue;
        const key = normalizedName.toLowerCase();
        if (seenTeamNames.has(key)) continue;
        seenTeamNames.add(key);

        const teamId = generateId();
        await tx.insert(teamSchema.team).values({
          id: teamId,
          name: normalizedName,
          organizationId: orgId,
          emoji: '👥',
        });

        if (teamInput.leadId) {
          await tx.insert(teamSchema.teamMember).values({
            id: generateId(),
            teamId,
            userId: teamInput.leadId,
            tag: TEAM_MEMBER_TAGS.Lead,
          });
        }

        teamCount++;
      }

      return {
        org: { id: org.id, name: org.name, slug: org.slug },
        memberCount: addedUserIds.size,
        teamCount,
      };
    });
  }

  async createOrganization(
    userId: string,
    data: CreateOrganizationDto,
  ): Promise<typeof orgSchema.organization.$inferSelect> {
    // Check if an organization with this slug already exists
    const [existing] = await this.database
      .select({ id: orgSchema.organization.id })
      .from(orgSchema.organization)
      .where(eq(orgSchema.organization.slug, data.slug))
      .limit(1);

    if (existing) {
      throw new ConflictException(
        'An organization with this slug already exists',
      );
    }

    const orgId = generateId();

    let org: typeof orgSchema.organization.$inferSelect | undefined;
    try {
      const [createdOrg] = await this.database
        .insert(orgSchema.organization)
        .values({
          id: orgId,
          name: data.name,
          slug: data.slug,
          logo: data.logo ?? null,
          ownerId: userId,
        })
        .returning();
      org = createdOrg;
    } catch (error: unknown) {
      // Handle race condition: slug uniqueness violation
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        throw new ConflictException(
          'An organization with this slug already exists',
        );
      }
      throw error;
    }

    await this.database.insert(orgSchema.organizationMember).values({
      id: generateId(),
      organizationId: orgId,
      userId,
      role: ORG_MEMBER_ROLES.Owner,
    });

    if (!org) {
      throw new ConflictException('Failed to create organization');
    }

    return org;
  }

  async getUserOrganizations(
    userId: string,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const normalizedSearch = search?.trim();

    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(orgSchema.organizationMember.userId, userId)];
    if (normalizedSearch) {
      conditions.push(
        ilike(orgSchema.organization.name, `%${normalizedSearch}%`),
      );
    }
    const whereClause = and(...conditions);

    const orgs = await this.database
      .select({ organization: orgSchema.organization })
      .from(orgSchema.organization)
      .innerJoin(
        orgSchema.organizationMember,
        eq(
          orgSchema.organizationMember.organizationId,
          orgSchema.organization.id,
        ),
      )
      .where(whereClause)
      .orderBy(desc(orgSchema.organization.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalCount] = await this.database
      .select({ count: count() })
      .from(orgSchema.organization)
      .innerJoin(
        orgSchema.organizationMember,
        eq(
          orgSchema.organizationMember.organizationId,
          orgSchema.organization.id,
        ),
      )
      .where(whereClause);

    const organizationRows = orgs.map(({ organization }) => organization);
    const organizationsWithCounts =
      await this.attachMemberCounts(organizationRows);

    const result = {
      organizations: organizationsWithCounts,
      total: totalCount.count,
      page,
      limit,
      totalPages: Math.ceil(totalCount.count / limit),
    };

    return result;
  }

  async getAllOrganizations(
    userId: string,
    page = 1,
    limit = 10,
    search?: string,
    sort?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    const isAdmin = await this.isSystemAdmin(userId);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Only system admins can list all organizations',
      );
    }

    const offset = (page - 1) * limit;

    const normalizedSearch = search?.trim();
    const conditions: SQL[] = [];
    if (normalizedSearch) {
      conditions.push(
        ilike(orgSchema.organization.name, `%${normalizedSearch}%`),
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const dirFn = sortOrder === 'asc' ? asc : desc;

    const validColumns = {
      name: orgSchema.organization.name,
      slug: orgSchema.organization.slug,
      ownerId: orgSchema.organization.ownerId,
      createdAt: orgSchema.organization.createdAt,
    } as const;

    let orderByClause: SQL;
    if (sort === 'memberCount') {
      const memberCountSql = sql`(SELECT COUNT(*) FROM organization_member WHERE organization_member.organization_id = ${orgSchema.organization.id})`;
      orderByClause = dirFn(memberCountSql);
    } else {
      const sortKey =
        sort && sort in validColumns
          ? (sort as keyof typeof validColumns)
          : 'createdAt';
      orderByClause = dirFn(validColumns[sortKey]);
    }

    const orgs = await this.database
      .select()
      .from(orgSchema.organization)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const [filteredTotalCount] = await this.database
      .select({ count: count() })
      .from(orgSchema.organization)
      .where(whereClause);

    const organizationsWithCounts = await this.attachMemberCounts(orgs);

    return {
      organizations: organizationsWithCounts,
      total: filteredTotalCount.count,
      page,
      limit,
      totalPages: Math.ceil(filteredTotalCount.count / limit),
    };
  }

  async getOrganizationById(userId: string, orgId: string) {
    const [org] = await this.database
      .select()
      .from(orgSchema.organization)
      .where(eq(orgSchema.organization.id, orgId))
      .limit(1);

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const isAdmin = await this.isSystemAdmin(userId);
    const [membership] = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.organizationId, orgId),
          eq(orgSchema.organizationMember.userId, userId),
        ),
      )
      .limit(1);

    if (!isAdmin && !membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    const members = await this.database
      .select({
        member: orgSchema.organizationMember,
        user: userSchema.user,
      })
      .from(orgSchema.organizationMember)
      .innerJoin(
        userSchema.user,
        eq(userSchema.user.id, orgSchema.organizationMember.userId),
      )
      .where(eq(orgSchema.organizationMember.organizationId, orgId))
      .orderBy(desc(orgSchema.organizationMember.createdAt));

    return {
      ...org,
      myRole: membership?.role ?? null,
      memberCount: members.length,
      members: members.map(({ member, user }) => ({ ...member, user })),
    };
  }

  async updateOrganization(
    userId: string,
    orgId: string,
    data: UpdateOrganizationDto,
  ) {
    const isAdmin = await this.isSystemAdmin(userId);
    const isOrgAdmin = await this.isOrgAdmin(userId, orgId);

    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only system admins and organization admins can update organizations',
      );
    }

    const [org] = await this.database
      .update(orgSchema.organization)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orgSchema.organization.id, orgId))
      .returning();

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async deleteOrganization(userId: string, orgId: string) {
    const isAdmin = await this.isSystemAdmin(userId);
    const isOwner = await this.isOrgOwner(userId, orgId);

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'Only system admins and organization owners can delete organizations',
      );
    }

    const [org] = await this.database
      .delete(orgSchema.organization)
      .where(eq(orgSchema.organization.id, orgId))
      .returning();

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async getOrganizationMembers(
    userId: string,
    orgId: string,
    page = 1,
    limit = 10,
    search?: string,
  ) {
    const isAdmin = await this.isSystemAdmin(userId);
    const [membership] = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.organizationId, orgId),
          eq(orgSchema.organizationMember.userId, userId),
        ),
      )
      .limit(1);

    if (!isAdmin && !membership) {
      throw new ForbiddenException(
        'You do not have access to this organization',
      );
    }

    const offset = (page - 1) * limit;

    const conditions: SQL[] = [
      eq(orgSchema.organizationMember.organizationId, orgId),
    ];

    if (search && search.trim().length >= 2) {
      const pattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(userSchema.user.name, pattern),
          ilike(userSchema.user.email, pattern),
        )!,
      );
    }

    const members = await this.database
      .select({
        member: orgSchema.organizationMember,
        user: userSchema.user,
      })
      .from(orgSchema.organizationMember)
      .innerJoin(
        userSchema.user,
        eq(userSchema.user.id, orgSchema.organizationMember.userId),
      )
      .where(and(...conditions))
      .orderBy(desc(orgSchema.organizationMember.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalCount] = await this.database
      .select({ count: count() })
      .from(orgSchema.organizationMember)
      .innerJoin(
        userSchema.user,
        eq(userSchema.user.id, orgSchema.organizationMember.userId),
      )
      .where(and(...conditions));

    return {
      members: members.map(({ member, user }) => ({ ...member, user })),
      total: totalCount.count,
      page,
      limit,
      totalPages: Math.ceil(totalCount.count / limit),
    };
  }

  async addOrganizationMember(
    userId: string,
    orgId: string,
    data: AddMemberDto,
  ) {
    const isAdmin = await this.isSystemAdmin(userId);
    const isOrgAdmin = await this.isOrgAdmin(userId, orgId);

    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only system admins and organization admins can add members',
      );
    }

    const [org] = await this.database
      .select({ name: orgSchema.organization.name })
      .from(orgSchema.organization)
      .where(eq(orgSchema.organization.id, orgId))
      .limit(1);

    if (!org) throw new NotFoundException('Organisation not found');

    const [existing] = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.organizationId, orgId),
          eq(orgSchema.organizationMember.userId, data.userId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(
        'User is already a member of this organization',
      );
    }

    const [member] = await this.database
      .insert(orgSchema.organizationMember)
      .values({
        id: generateId(),
        organizationId: orgId,
        userId: data.userId,
        role: data.role,
      })
      .returning();

    await this.database
      .update(userSchema.user)
      .set({
        status: USER_STATUSES.Approved,
        approvedAt: new Date(),
        approvedById: userId,
      })
      .where(
        and(
          eq(userSchema.user.id, data.userId),
          eq(userSchema.user.status, USER_STATUSES.Pending),
        ),
      );

    void this.notificationsService
      .notifyUserOfOrgInvite(data.userId, orgId, org.name)
      .catch(() => undefined);

    return member;
  }

  async removeOrganizationMember(
    userId: string,
    orgId: string,
    memberId: string,
  ) {
    const isAdmin = await this.isSystemAdmin(userId);
    const isOrgAdmin = await this.isOrgAdmin(userId, orgId);

    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only system admins and organization admins can remove members',
      );
    }

    const [member] = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.organizationId, orgId),
          eq(orgSchema.organizationMember.userId, memberId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const [deleted] = await this.database
      .delete(orgSchema.organizationMember)
      .where(eq(orgSchema.organizationMember.id, member.id))
      .returning();

    return deleted;
  }

  async updateOrganizationMemberRole(
    userId: string,
    orgId: string,
    memberId: string,
    role: TOrgAssignableRole,
  ) {
    const isAdmin = await this.isSystemAdmin(userId);
    const isOwner = await this.isOrgOwner(userId, orgId);

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'Only system admins and organization owners can update member roles',
      );
    }

    const [member] = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.organizationId, orgId),
          eq(orgSchema.organizationMember.userId, memberId),
        ),
      )
      .limit(1);

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const [updated] = await this.database
      .update(orgSchema.organizationMember)
      .set({ role })
      .where(eq(orgSchema.organizationMember.id, member.id))
      .returning();

    return updated;
  }

  async leaveOrganization(userId: string, orgId: string) {
    const [org] = await this.database
      .select()
      .from(orgSchema.organization)
      .where(eq(orgSchema.organization.id, orgId))
      .limit(1);

    if (!org) throw new NotFoundException('Organization not found');

    // Owner cannot leave — they must transfer or delete the org
    if (org.ownerId === userId) {
      throw new ForbiddenException(
        'Organization owner cannot leave. Transfer ownership or delete the organization.',
      );
    }

    const [member] = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, userId),
          eq(orgSchema.organizationMember.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!member)
      throw new NotFoundException('You are not a member of this organization');

    await this.database
      .delete(orgSchema.organizationMember)
      .where(eq(orgSchema.organizationMember.id, member.id));

    return { message: 'Left organization successfully' };
  }
}
