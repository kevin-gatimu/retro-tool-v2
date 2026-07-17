import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  eq,
  and,
  gte,
  or,
  like,
  inArray,
  notInArray,
  desc,
  asc,
  count,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import * as userSchema from './schema';
import * as orgSchema from '../organizations/schema';
import * as teamSchema from '../teams/schema';
import {
  TUserStatusFilter,
  TUserRoleFilter,
  USER_ROLES,
  USER_STATUSES,
} from '../common/enums';
import { CommonService } from '../common/common.service';

type Database = NodePgDatabase<
  typeof userSchema & typeof orgSchema & typeof teamSchema
>;

/**
 * Read-only admin queries over users: paginated listing with status/role
 * aggregation, single-user lookup, full user-detail assembly, and the admin
 * action log. Split out of UsersService for the V5 service-size guideline;
 * behavior is identical to the original methods.
 */
@Injectable()
export class UsersQueryService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
    private readonly commonService: CommonService,
  ) {}

  async findAll(
    adminId: string,
    options?: {
      search?: string;
      status?: TUserStatusFilter;
      role?: TUserRoleFilter;
      membership?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    await this.commonService.requireSystemAdmin(adminId);

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (options?.search) {
      const term = `%${options.search}%`;
      conditions.push(
        or(
          like(userSchema.user.name, term),
          like(userSchema.user.email, term),
        ) as ReturnType<typeof eq>,
      );
    }

    if (options?.status && options.status !== 'all') {
      conditions.push(eq(userSchema.user.status, options.status));
    }

    if (options?.role && options.role !== 'all') {
      conditions.push(eq(userSchema.user.role, options.role));
    }

    if (options?.membership === 'no-org') {
      const orgMemberUserIds = this.database
        .select({ userId: orgSchema.organizationMember.userId })
        .from(orgSchema.organizationMember);
      conditions.push(notInArray(userSchema.user.id, orgMemberUserIds));
    }

    if (options?.membership === 'no-team') {
      const orgMemberUserIds = this.database
        .select({ userId: orgSchema.organizationMember.userId })
        .from(orgSchema.organizationMember);
      const teamMemberUserIds = this.database
        .select({ userId: teamSchema.teamMember.userId })
        .from(teamSchema.teamMember);
      conditions.push(inArray(userSchema.user.id, orgMemberUserIds));
      conditions.push(notInArray(userSchema.user.id, teamMemberUserIds));
    }

    const sortableColumns: Record<string, unknown> = {
      name: userSchema.user.name,
      email: userSchema.user.email,
      status: userSchema.user.status,
      role: userSchema.user.role,
      createdAt: userSchema.user.createdAt,
      lastActiveAt: userSchema.user.lastActiveAt,
    };

    const selectedSortColumn =
      (options?.sortBy && sortableColumns[options.sortBy]) ||
      userSchema.user.createdAt;
    const sortDirection = options?.sortOrder === 'asc' ? asc : desc;

    const users = await this.database
      .select()
      .from(userSchema.user)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        sortDirection(selectedSortColumn as Parameters<typeof asc>[0]),
        desc(userSchema.user.createdAt),
      )
      .limit(limit)
      .offset(offset);

    const [totalCount] = await this.database
      .select({ count: count() })
      .from(userSchema.user)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const buildWhere = (extraCondition?: ReturnType<typeof eq>) => {
      if (conditions.length > 0 && extraCondition) {
        return and(...conditions, extraCondition);
      }
      if (conditions.length > 0) {
        return and(...conditions);
      }
      return extraCondition;
    };

    const [pendingCount] = await this.database
      .select({ count: count() })
      .from(userSchema.user)
      .where(buildWhere(eq(userSchema.user.status, USER_STATUSES.Pending)));

    const [approvedCount] = await this.database
      .select({ count: count() })
      .from(userSchema.user)
      .where(buildWhere(eq(userSchema.user.status, USER_STATUSES.Approved)));

    const [suspendedCount] = await this.database
      .select({ count: count() })
      .from(userSchema.user)
      .where(buildWhere(eq(userSchema.user.status, USER_STATUSES.Suspended)));

    const [rejectedCount] = await this.database
      .select({ count: count() })
      .from(userSchema.user)
      .where(buildWhere(eq(userSchema.user.status, USER_STATUSES.Rejected)));

    const [adminsCount] = await this.database
      .select({ count: count() })
      .from(userSchema.user)
      .where(
        buildWhere(
          or(
            eq(userSchema.user.role, USER_ROLES.SuperAdmin),
            eq(userSchema.user.role, USER_ROLES.SystemAdmin),
          ) as ReturnType<typeof eq>,
        ),
      );

    return {
      users,
      total: totalCount.count,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(totalCount.count / limit)),
      stats: {
        pending: pendingCount.count,
        approved: approvedCount.count,
        suspended: suspendedCount.count,
        rejected: rejectedCount.count,
        admins: adminsCount.count,
      },
    };
  }

  async findOne(
    adminId: string,
    id: string,
  ): Promise<typeof userSchema.user.$inferSelect | undefined> {
    await this.commonService.requireSystemAdmin(adminId);

    const [user] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.id, id))
      .limit(1);

    return user;
  }

  async getUserDetails(adminId: string, targetId: string) {
    await this.commonService.requireSystemAdmin(adminId);

    const [target] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.id, targetId))
      .limit(1);

    if (!target) throw new NotFoundException('User not found');

    const orgMemberships = await this.database
      .select({
        membership: orgSchema.organizationMember,
        organization: orgSchema.organization,
      })
      .from(orgSchema.organizationMember)
      .innerJoin(
        orgSchema.organization,
        eq(
          orgSchema.organization.id,
          orgSchema.organizationMember.organizationId,
        ),
      )
      .where(eq(orgSchema.organizationMember.userId, targetId));

    const teamMemberships = await this.database
      .select({
        membership: teamSchema.teamMember,
        team: teamSchema.team,
        organization: orgSchema.organization,
      })
      .from(teamSchema.teamMember)
      .innerJoin(
        teamSchema.team,
        eq(teamSchema.team.id, teamSchema.teamMember.teamId),
      )
      .innerJoin(
        orgSchema.organization,
        eq(orgSchema.organization.id, teamSchema.team.organizationId),
      )
      .where(eq(teamSchema.teamMember.userId, targetId));

    const actionHistory = await this.database
      .select({
        log: userSchema.adminActionLog,
        admin: userSchema.user,
      })
      .from(userSchema.adminActionLog)
      .innerJoin(
        userSchema.user,
        eq(userSchema.user.id, userSchema.adminActionLog.adminId),
      )
      .where(eq(userSchema.adminActionLog.targetUserId, targetId))
      .orderBy(desc(userSchema.adminActionLog.createdAt));

    return {
      user: target,
      organizations: orgMemberships.map(({ membership, organization }) => ({
        ...membership,
        organization,
      })),
      teams: teamMemberships.map(({ membership, team, organization }) => ({
        ...membership,
        team: { ...team, organization },
      })),
      actionHistory: actionHistory.map(({ log, admin }) => ({
        ...log,
        admin,
      })),
    };
  }

  async getAdminActionLog(
    adminId: string,
    options?: {
      page?: number;
      limit?: number;
      userId?: string;
      dateRange?: 'today' | 'week' | 'month' | 'year';
      adminRole?: string;
    },
  ) {
    await this.commonService.requireSystemAdmin(adminId);

    // Super-admins see everything; system-admins cannot see super-admin logs
    const callerIsSuperAdmin = await this.commonService.isSuperAdmin(adminId);

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    // Build conditions
    let dateCondition: ReturnType<typeof gte> | undefined;
    if (options?.dateRange) {
      const now = new Date();
      let startDate: Date;
      switch (options.dateRange) {
        case 'today':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,
            0,
            0,
            0,
          );
          break;
        case 'week': {
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          startDate.setHours(0, 0, 0, 0);
          break;
        }
        case 'month':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            1,
            0,
            0,
            0,
            0,
          );
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          break;
        default:
          startDate = now;
      }
      dateCondition = gte(userSchema.adminActionLog.createdAt, startDate);
    }

    // For system-admin callers, cap the role filter to exclude super-admins.
    // If no explicit role filter is set, system-admins still cannot see super-admin logs.
    let effectiveAdminRole: string | undefined;
    if (!callerIsSuperAdmin) {
      // Requested role (if any); ignore 'super-admin' even if somehow passed
      const requested =
        options?.adminRole && options.adminRole !== 'all'
          ? options.adminRole
          : undefined;
      effectiveAdminRole =
        requested && requested !== USER_ROLES.SuperAdmin
          ? requested
          : undefined;
    } else {
      effectiveAdminRole =
        options?.adminRole && options.adminRole !== 'all'
          ? options.adminRole
          : undefined;
    }

    const conditions = [
      options?.userId
        ? eq(userSchema.adminActionLog.targetUserId, options.userId)
        : undefined,
      dateCondition,
      effectiveAdminRole
        ? eq(
            userSchema.user.role,
            effectiveAdminRole as typeof userSchema.user.role._.data,
          )
        : undefined,
    ].filter(Boolean);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const targetUserAlias = alias(userSchema.user, 'target_user');

    const [results, totalResult] = await Promise.all([
      this.database
        .select({
          log: userSchema.adminActionLog,
          admin: userSchema.user,
          targetUser: targetUserAlias,
        })
        .from(userSchema.adminActionLog)
        .innerJoin(
          userSchema.user,
          eq(userSchema.user.id, userSchema.adminActionLog.adminId),
        )
        .leftJoin(
          targetUserAlias,
          eq(targetUserAlias.id, userSchema.adminActionLog.targetUserId),
        )
        .where(whereClause)
        .orderBy(desc(userSchema.adminActionLog.createdAt))
        .limit(limit)
        .offset(offset),
      // Count also needs the admin join when filtering by adminRole
      this.database
        .select({ count: count() })
        .from(userSchema.adminActionLog)
        .innerJoin(
          userSchema.user,
          eq(userSchema.user.id, userSchema.adminActionLog.adminId),
        )
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;

    return {
      logs: results.map(({ log, admin, targetUser }) => ({
        ...log,
        admin,
        targetUser: targetUser
          ? {
              id: targetUser.id,
              name: targetUser.name,
              email: targetUser.email,
            }
          : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
