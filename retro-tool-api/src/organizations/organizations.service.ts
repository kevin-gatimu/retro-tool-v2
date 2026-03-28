import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Config } from '../config/configuration';
import { EmailService } from '../email/email.service';
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
import { generateId } from '../lib/utils';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CommonService } from '../common/common.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache-keys';
import {
  EMAIL_LOG_TYPES,
  ORG_MEMBER_ROLES,
  TOrgAssignableRole,
  TOrgMemberRole,
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
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<Config>,
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

    await this.cacheService.delPattern(CacheKeys.userOrgsPattern(userId));

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
    const cacheKey = CacheKeys.userOrgs(userId, page, limit, normalizedSearch);
    const cached = await this.cacheService.get<{
      organizations: Array<
        typeof orgSchema.organization.$inferSelect & { memberCount: number }
      >;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

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

    await this.cacheService.set(cacheKey, result, 120);
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

    await this.cacheService.delPattern(CacheKeys.orgTeamsOrgPattern(orgId));
    await this.cacheService.delPattern(CacheKeys.userOrgsPattern(org.ownerId));

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

    await this.cacheService.delPattern(CacheKeys.reportsAllPattern());

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
      throw new ForbiddenException(
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

    await this.cacheService.del(CacheKeys.rbacOrg(orgId, data.userId));
    await this.cacheService.delPattern(CacheKeys.userOrgsPattern(data.userId));
    await this.cacheService.delPattern(
      CacheKeys.orgTeamsPattern(orgId, data.userId),
    );
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

    await this.cacheService.del(CacheKeys.rbacOrg(orgId, memberId));
    await this.cacheService.delPattern(CacheKeys.userOrgsPattern(memberId));
    await this.cacheService.delPattern(
      CacheKeys.orgTeamsPattern(orgId, memberId),
    );
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

    await this.cacheService.del(CacheKeys.rbacOrg(orgId, memberId));
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

    await this.cacheService.del(CacheKeys.rbacOrg(orgId, userId));
    await this.cacheService.delPattern(CacheKeys.userOrgsPattern(userId));
    await this.cacheService.delPattern(
      CacheKeys.orgTeamsPattern(orgId, userId),
    );
    return { message: 'Left organization successfully' };
  }

  async inviteOrganizationMember(
    userId: string,
    orgId: string,
    email: string,
    role: TOrgMemberRole,
  ) {
    const isAdmin = await this.isSystemAdmin(userId);
    const isOrgAdmin = await this.isOrgAdmin(userId, orgId);

    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only system admins and organization admins can invite members',
      );
    }

    // Only org owners (or system admins) can assign the org-owner role
    if (role === ORG_MEMBER_ROLES.Owner) {
      const isOwner = await this.isOrgOwner(userId, orgId);
      if (!isAdmin && !isOwner) {
        throw new ForbiddenException(
          'Only system admins and the organization owner can invite users as org-owner',
        );
      }
    }

    const [invitee] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.email, email))
      .limit(1);

    if (!invitee)
      throw new NotFoundException('No user found with that email address');

    const [existing] = await this.database
      .select()
      .from(orgSchema.organizationMember)
      .where(
        and(
          eq(orgSchema.organizationMember.userId, invitee.id),
          eq(orgSchema.organizationMember.organizationId, orgId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ForbiddenException(
        'User is already a member of this organization',
      );
    }

    const [org] = await this.database
      .select({ name: orgSchema.organization.name })
      .from(orgSchema.organization)
      .where(eq(orgSchema.organization.id, orgId))
      .limit(1);

    const [member] = await this.database
      .insert(orgSchema.organizationMember)
      .values({
        id: generateId(),
        organizationId: orgId,
        userId: invitee.id,
        role,
      })
      .returning();

    // Auto-approve pending accounts when added to an org
    await this.database
      .update(userSchema.user)
      .set({
        status: USER_STATUSES.Approved,
        approvedAt: new Date(),
        approvedById: userId,
      })
      .where(
        and(
          eq(userSchema.user.id, invitee.id),
          eq(userSchema.user.status, USER_STATUSES.Pending),
        ),
      );

    await this.cacheService.del(CacheKeys.rbacOrg(orgId, invitee.id));
    await this.cacheService.delPattern(CacheKeys.userOrgsPattern(invitee.id));
    await this.cacheService.delPattern(
      CacheKeys.orgTeamsPattern(orgId, invitee.id),
    );

    void this.notificationsService
      .notifyUserOfOrgInvite(invitee.id, orgId, org?.name ?? 'the organisation')
      .catch(() => undefined);

    // Send org invite email
    const appUrl =
      this.configService.get('frontend.url', { infer: true }) ?? '';
    void this.emailService
      .send({
        to: invitee.email,
        subject: `You've been invited to join ${org?.name ?? 'an organisation'}`,
        html: this.emailService.buildOrgInviteHtml({
          userName: invitee.name,
          orgName: org?.name ?? 'an organisation',
          role,
          appUrl,
        }),
        userId: invitee.id,
        type: EMAIL_LOG_TYPES.OrgInvite,
      })
      .catch(() => undefined);

    return member;
  }
}
