import { reportBestEffortFailure } from '../common/best-effort';
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
import { eq, and, ne, or, inArray } from 'drizzle-orm';
import * as userSchema from './schema';
import * as orgSchema from '../organizations/schema';
import * as teamSchema from '../teams/schema';
import {
  UpdateStatusDto,
  UpdateRoleDto,
  SuspendUserDto,
  BulkUpdateStatusDto,
} from './dtos';
import {
  ADMIN_ACTION_LOG_ACTIONS,
  getAdminActionFromStatus,
  EMAIL_LOG_TYPES,
  USER_ROLES,
  USER_STATUSES,
} from '../common/enums';
import { CommonService } from '../common/common.service';

type Database = NodePgDatabase<
  typeof userSchema & typeof orgSchema & typeof teamSchema
>;

/**
 * Admin-only user mutations: status/role changes, promote/demote, suspend/
 * reactivate, bulk status updates, and first-admin bootstrap. Split out of
 * UsersService for the V5 service-size guideline; behavior is identical to
 * the original methods.
 */
@Injectable()
export class UsersAdminService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
    private readonly commonService: CommonService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService<Config>,
  ) {}

  async updateStatus(adminId: string, targetId: string, data: UpdateStatusDto) {
    await this.commonService.requireSystemAdmin(adminId);

    const [updated] = await this.database
      .update(userSchema.user)
      .set({
        status: data.status,
        approvedAt: data.status === USER_STATUSES.Approved ? new Date() : null,
        approvedById: data.status === USER_STATUSES.Approved ? adminId : null,
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
    if (data.status === USER_STATUSES.Approved && updated) {
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
        .catch(reportBestEffortFailure('Users admin side effect'));
    }

    return updated;
  }

  async updateRole(adminId: string, targetId: string, data: UpdateRoleDto) {
    await this.commonService.requireSystemAdmin(adminId);

    if (data.role === USER_ROLES.SuperAdmin) {
      throw new ForbiddenException('Cannot assign super-admin role');
    }

    const isSuperAdmin = await this.commonService.isSuperAdmin(adminId);

    if (data.role === USER_ROLES.Member && targetId === adminId) {
      const otherAdmins = await this.database
        .select()
        .from(userSchema.user)
        .where(
          and(
            or(
              eq(userSchema.user.role, USER_ROLES.SuperAdmin),
              eq(userSchema.user.role, USER_ROLES.SystemAdmin),
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
    if (data.role === USER_ROLES.SystemAdmin && !isSuperAdmin) {
      throw new ForbiddenException(
        'Only super-admin can promote users to system-admin',
      );
    }

    if (
      target.role === USER_ROLES.SystemAdmin &&
      data.role !== USER_ROLES.SystemAdmin &&
      !isSuperAdmin
    ) {
      throw new ForbiddenException(
        'Only super-admin can demote a system-admin',
      );
    }

    if (target.role === USER_ROLES.SuperAdmin) {
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
      ADMIN_ACTION_LOG_ACTIONS.UserRoleChanged,
      {
        previousRole: target.role,
        newRole: data.role,
      },
    );

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

    if (target.role === USER_ROLES.SuperAdmin) {
      throw new ForbiddenException('Cannot modify super-admin role');
    }

    if (target.role === USER_ROLES.SystemAdmin) {
      return target;
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({ role: USER_ROLES.SystemAdmin, updatedAt: new Date() })
      .where(eq(userSchema.user.id, targetId))
      .returning();

    await this.commonService.logAdminAction(
      adminId,
      targetId,
      ADMIN_ACTION_LOG_ACTIONS.UserRoleChanged,
      {
        previousRole: target.role,
        newRole: USER_ROLES.SystemAdmin,
      },
    );

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

    if (target.role === USER_ROLES.SuperAdmin) {
      throw new ForbiddenException('Cannot modify super-admin role');
    }

    if (target.role !== USER_ROLES.SystemAdmin) {
      throw new BadRequestException('Target user is not a system-admin');
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({ role: USER_ROLES.Member, updatedAt: new Date() })
      .where(eq(userSchema.user.id, targetId))
      .returning();

    await this.commonService.logAdminAction(
      adminId,
      targetId,
      ADMIN_ACTION_LOG_ACTIONS.UserRoleChanged,
      {
        previousRole: target.role,
        newRole: USER_ROLES.Member,
      },
    );

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

    if (target.role === USER_ROLES.SuperAdmin) {
      throw new ForbiddenException('Cannot suspend the super-admin');
    }

    if (target.role === USER_ROLES.SystemAdmin && !adminIsSuperAdmin) {
      throw new ForbiddenException(
        'Only super-admin can suspend a system-admin',
      );
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({
        status: USER_STATUSES.Suspended,
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
      ADMIN_ACTION_LOG_ACTIONS.UserSuspended,
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
    if (target.role === USER_ROLES.SystemAdmin && !adminIsSuperAdmin) {
      throw new ForbiddenException(
        'Only super-admin can reactivate a system-admin',
      );
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({
        status: USER_STATUSES.Approved,
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
      ADMIN_ACTION_LOG_ACTIONS.UserReactivated,
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
          u.role !== USER_ROLES.SuperAdmin &&
          u.role !== USER_ROLES.SystemAdmin,
      )
      .map((u) => u.id);

    if (validIds.length === 0) {
      throw new BadRequestException('No valid users to update');
    }

    const updateData: Record<string, unknown> = {
      status: data.status,
      updatedAt: new Date(),
    };

    if (data.status === USER_STATUSES.Approved) {
      updateData.approvedAt = new Date();
      updateData.approvedById = adminId;
      updateData.suspendedAt = null;
      updateData.suspendedById = null;
      updateData.suspendedReason = null;
    } else if (data.status === USER_STATUSES.Suspended) {
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
      if (data.status === USER_STATUSES.Approved) {
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
            .catch(reportBestEffortFailure('Users admin side effect'));
        }
      }
    }

    return { updated: validIds.length };
  }

  async bootstrapFirstAdmin(userId: string) {
    const { exists } = await this.commonService.checkAdminExists();

    if (exists) {
      throw new BadRequestException('An admin already exists');
    }

    const [updated] = await this.database
      .update(userSchema.user)
      .set({
        role: USER_ROLES.SuperAdmin,
        status: USER_STATUSES.Approved,
        approvedAt: new Date(),
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(userSchema.user.id, userId))
      .returning();

    return updated;
  }
}
