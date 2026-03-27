import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Config } from '../config/configuration';
import { EmailService } from '../email/email.service';
import {
  eq,
  and,
  gte,
  ne,
  or,
  like,
  inArray,
  desc,
  asc,
  count,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import * as userSchema from './schema';
import * as orgSchema from '../organizations/schema';
import * as teamSchema from '../teams/schema';
import {
  UpdateStatusDto,
  UpdateRoleDto,
  UpdateProfileDto,
  SuspendUserDto,
  BulkUpdateStatusDto,
} from './dtos';
import {
  TUserStatusFilter,
  TUserRoleFilter,
  getAdminActionFromStatus,
  EMAIL_LOG_TYPES,
} from '../common/enums';
import { CommonService } from '../common/common.service';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cache-keys';

type Database = NodePgDatabase<
  typeof userSchema & typeof orgSchema & typeof teamSchema
>;

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
    private readonly commonService: CommonService,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<Config>,
  ) {}

  // ============================================================================
  // Public / authenticated user endpoints
  // ============================================================================

  async getMe(userId: string) {
    const [user] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.id, userId))
      .limit(1);

    return user ?? null;
  }

  async searchApproved(search?: string) {
    const conditions = [eq(userSchema.user.status, 'approved')];

    if (search && search.length > 0) {
      const term = `%${search}%`;
      conditions.push(
        or(
          like(userSchema.user.name, term),
          like(userSchema.user.email, term),
        ) as ReturnType<typeof eq>,
      );
    }

    return this.database
      .select({
        id: userSchema.user.id,
        name: userSchema.user.name,
        email: userSchema.user.email,
        image: userSchema.user.image,
      })
      .from(userSchema.user)
      .where(and(...conditions))
      .orderBy(userSchema.user.name)
      .limit(20);
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const [updated] = await this.database
      .update(userSchema.user)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSchema.user.id, userId))
      .returning();

    return updated;
  }

  async deleteUser(requesterId: string, targetId: string) {
    const [requester] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.id, requesterId))
      .limit(1);

    const isSelf = requesterId === targetId;
    const isAdmin =
      requester?.role === 'super-admin' || requester?.role === 'system-admin';

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('You can only delete your own account');
    }

    const [target] = await this.database
      .select({ role: userSchema.user.role })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, targetId))
      .limit(1);

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.role === 'super-admin') {
      throw new ForbiddenException('Super admin accounts cannot be deleted');
    }

    if (target.role === 'system-admin') {
      throw new ForbiddenException('System admin accounts cannot be deleted');
    }

    if (isSelf && isAdmin) {
      const otherAdmins = await this.database
        .select()
        .from(userSchema.user)
        .where(
          and(
            or(
              eq(userSchema.user.role, 'super-admin'),
              eq(userSchema.user.role, 'system-admin'),
            ),
            ne(userSchema.user.id, targetId),
          ),
        );

      if (otherAdmins.length === 0) {
        throw new BadRequestException('Cannot delete the last admin');
      }
    }

    if (isAdmin && !isSelf) {
      await this.commonService.logAdminAction(
        requesterId,
        targetId,
        'user_deleted',
      );
    }

    await this.database
      .delete(userSchema.user)
      .where(eq(userSchema.user.id, targetId));

    return { success: true };
  }

  // ============================================================================
  // Admin-only endpoints
  // ============================================================================

  async findAll(
    adminId: string,
    options?: {
      search?: string;
      status?: TUserStatusFilter;
      role?: TUserRoleFilter;
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
      .where(buildWhere(eq(userSchema.user.status, 'pending')));

    const [approvedCount] = await this.database
      .select({ count: count() })
      .from(userSchema.user)
      .where(buildWhere(eq(userSchema.user.status, 'approved')));

    const [suspendedCount] = await this.database
      .select({ count: count() })
      .from(userSchema.user)
      .where(buildWhere(eq(userSchema.user.status, 'suspended')));

    const [rejectedCount] = await this.database
      .select({ count: count() })
      .from(userSchema.user)
      .where(buildWhere(eq(userSchema.user.status, 'rejected')));

    const [adminsCount] = await this.database
      .select({ count: count() })
      .from(userSchema.user)
      .where(
        buildWhere(
          or(
            eq(userSchema.user.role, 'super-admin'),
            eq(userSchema.user.role, 'system-admin'),
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

  async updateStatus(adminId: string, targetId: string, data: UpdateStatusDto) {
    await this.commonService.requireSystemAdmin(adminId);

    const [updated] = await this.database
      .update(userSchema.user)
      .set({
        status: data.status,
        approvedAt: data.status === 'approved' ? new Date() : null,
        approvedById: data.status === 'approved' ? adminId : null,
        updatedAt: new Date(),
      })
      .where(eq(userSchema.user.id, targetId))
      .returning();

    if (!updated) throw new NotFoundException('User not found');

    await this.commonService.logAdminAction(
      adminId,
      targetId,
      getAdminActionFromStatus(data.status),
    );

    // Send approval email if status is 'approved'
    if (data.status === 'approved' && updated) {
      const appUrl =
        this.configService.get('frontend.url', { infer: true }) ?? '';
      void this.emailService
        .send({
          to: updated.email,
          subject: 'Your account has been approved',
          html: this.emailService.buildAccountApprovedHtml({
            userName: updated.name,
            appUrl,
          }),
          userId: updated.id,
          type: EMAIL_LOG_TYPES.AccountApproved,
        })
        .catch(() => undefined);
    }

    return updated;
  }

  async updateRole(adminId: string, targetId: string, data: UpdateRoleDto) {
    await this.commonService.requireSystemAdmin(adminId);

    if (data.role === 'super-admin') {
      throw new ForbiddenException('Cannot assign super-admin role');
    }

    const isSuperAdmin = await this.commonService.isSuperAdmin(adminId);

    if (data.role === 'member' && targetId === adminId) {
      const otherAdmins = await this.database
        .select()
        .from(userSchema.user)
        .where(
          and(
            or(
              eq(userSchema.user.role, 'super-admin'),
              eq(userSchema.user.role, 'system-admin'),
            ),
            ne(userSchema.user.id, adminId),
          ),
        );

      if (otherAdmins.length === 0) {
        throw new BadRequestException('Cannot remove the last admin');
      }
    }

    const [target] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.id, targetId))
      .limit(1);

    if (!target) throw new NotFoundException('User not found');

    // System-admin transitions are restricted to super-admin via dedicated flows.
    if (data.role === 'system-admin' && !isSuperAdmin) {
      throw new ForbiddenException(
        'Only super-admin can promote users to system-admin',
      );
    }

    if (
      target.role === 'system-admin' &&
      data.role !== 'system-admin' &&
      !isSuperAdmin
    ) {
      throw new ForbiddenException(
        'Only super-admin can demote a system-admin',
      );
    }

    if (target.role === 'super-admin') {
      throw new ForbiddenException('Cannot modify super-admin role');
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({ role: data.role, updatedAt: new Date() })
      .where(eq(userSchema.user.id, targetId))
      .returning();

    await this.commonService.logAdminAction(
      adminId,
      targetId,
      'user_role_changed',
      {
        previousRole: target.role,
        newRole: data.role,
      },
    );

    await this.invalidateRbacForUser(targetId);
    return updated;
  }

  async promoteToSystemAdmin(adminId: string, targetId: string) {
    await this.commonService.requireSuperAdmin(adminId);

    const [target] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.id, targetId))
      .limit(1);

    if (!target) throw new NotFoundException('User not found');

    if (target.role === 'super-admin') {
      throw new ForbiddenException('Cannot modify super-admin role');
    }

    if (target.role === 'system-admin') {
      return target;
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({ role: 'system-admin', updatedAt: new Date() })
      .where(eq(userSchema.user.id, targetId))
      .returning();

    await this.commonService.logAdminAction(
      adminId,
      targetId,
      'user_role_changed',
      {
        previousRole: target.role,
        newRole: 'system-admin',
      },
    );

    await this.invalidateRbacForUser(targetId);
    return updated;
  }

  async demoteSystemAdminToMember(adminId: string, targetId: string) {
    await this.commonService.requireSuperAdmin(adminId);

    const [target] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.id, targetId))
      .limit(1);

    if (!target) throw new NotFoundException('User not found');

    if (target.role === 'super-admin') {
      throw new ForbiddenException('Cannot modify super-admin role');
    }

    if (target.role !== 'system-admin') {
      throw new BadRequestException('Target user is not a system-admin');
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({ role: 'member', updatedAt: new Date() })
      .where(eq(userSchema.user.id, targetId))
      .returning();

    await this.commonService.logAdminAction(
      adminId,
      targetId,
      'user_role_changed',
      {
        previousRole: target.role,
        newRole: 'member',
      },
    );

    await this.invalidateRbacForUser(targetId);
    return updated;
  }

  async suspendUser(adminId: string, targetId: string, data: SuspendUserDto) {
    await this.commonService.requireSystemAdmin(adminId);

    if (targetId === adminId) {
      throw new ForbiddenException('Cannot suspend yourself');
    }

    const [target] = await this.database
      .select()
      .from(userSchema.user)
      .where(eq(userSchema.user.id, targetId))
      .limit(1);

    if (!target) throw new NotFoundException('User not found');

    const adminIsSuperAdmin = await this.commonService.isSuperAdmin(adminId);

    if (target.role === 'super-admin') {
      throw new ForbiddenException('Cannot suspend the super-admin');
    }

    if (target.role === 'system-admin' && !adminIsSuperAdmin) {
      throw new ForbiddenException(
        'Only super-admin can suspend a system-admin',
      );
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({
        status: 'suspended',
        suspendedAt: new Date(),
        suspendedById: adminId,
        suspendedReason: data.reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(userSchema.user.id, targetId))
      .returning();

    await this.commonService.logAdminAction(
      adminId,
      targetId,
      'user_suspended',
      {
        reason: data.reason,
      },
    );

    return updated;
  }

  async reactivateUser(adminId: string, targetId: string) {
    await this.commonService.requireSystemAdmin(adminId);

    const [target] = await this.database
      .select({ role: userSchema.user.role })
      .from(userSchema.user)
      .where(eq(userSchema.user.id, targetId))
      .limit(1);

    if (!target) throw new NotFoundException('User not found');

    const adminIsSuperAdmin = await this.commonService.isSuperAdmin(adminId);
    if (target.role === 'system-admin' && !adminIsSuperAdmin) {
      throw new ForbiddenException(
        'Only super-admin can reactivate a system-admin',
      );
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({
        status: 'approved',
        suspendedAt: null,
        suspendedById: null,
        suspendedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(userSchema.user.id, targetId))
      .returning();

    await this.commonService.logAdminAction(
      adminId,
      targetId,
      'user_reactivated',
    );

    return updated;
  }

  async bulkUpdateStatus(adminId: string, data: BulkUpdateStatusDto) {
    await this.commonService.requireSystemAdmin(adminId);

    const targets = await this.database
      .select()
      .from(userSchema.user)
      .where(inArray(userSchema.user.id, data.userIds));

    const validIds = targets
      .filter(
        (u) =>
          u.id !== adminId &&
          u.role !== 'super-admin' &&
          u.role !== 'system-admin',
      )
      .map((u) => u.id);

    if (validIds.length === 0) {
      throw new BadRequestException('No valid users to update');
    }

    const updateData: Record<string, unknown> = {
      status: data.status,
      updatedAt: new Date(),
    };

    if (data.status === 'approved') {
      updateData.approvedAt = new Date();
      updateData.approvedById = adminId;
      updateData.suspendedAt = null;
      updateData.suspendedById = null;
      updateData.suspendedReason = null;
    } else if (data.status === 'suspended') {
      updateData.suspendedAt = new Date();
      updateData.suspendedById = adminId;
      updateData.suspendedReason = data.reason ?? null;
    }

    await this.database
      .update(userSchema.user)
      .set(updateData)
      .where(inArray(userSchema.user.id, validIds));

    const actionType = getAdminActionFromStatus(data.status);
    const appUrl =
      this.configService.get('frontend.url', { infer: true }) ?? '';

    for (const targetId of validIds) {
      await this.commonService.logAdminAction(adminId, targetId, actionType, {
        bulk: true,
        reason: data.reason,
      });

      // Send approval email if status is 'approved'
      if (data.status === 'approved') {
        const user = targets.find((u) => u.id === targetId);
        if (user) {
          void this.emailService
            .send({
              to: user.email,
              subject: 'Your account has been approved',
              html: this.emailService.buildAccountApprovedHtml({
                userName: user.name,
                appUrl,
              }),
              userId: user.id,
              type: EMAIL_LOG_TYPES.AccountApproved,
            })
            .catch(() => undefined);
        }
      }
    }

    return { updated: validIds.length };
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
        requested && requested !== 'super-admin' ? requested : undefined;
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

  async bootstrapFirstAdmin(userId: string) {
    const exists = await this.commonService.checkAdminExists();

    if (exists) {
      throw new BadRequestException('An admin already exists');
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({
        role: 'system-admin',
        status: 'approved',
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userSchema.user.id, userId))
      .returning();

    await this.invalidateRbacForUser(userId);
    return updated;
  }

  private async invalidateRbacForUser(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.del(CacheKeys.userRole(userId)),
      this.cacheService.delPattern(CacheKeys.rbacUserPattern(userId)),
    ]);
  }
}
