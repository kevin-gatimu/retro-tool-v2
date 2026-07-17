import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, ne, or, like } from 'drizzle-orm';
import * as userSchema from './schema';
import * as orgSchema from '../organizations/schema';
import * as teamSchema from '../teams/schema';
import { UpdateProfileDto } from './dtos';
import {
  ADMIN_ACTION_LOG_ACTIONS,
  USER_ROLES,
  USER_STATUSES,
} from '../common/enums';
import { CommonService } from '../common/common.service';

type Database = NodePgDatabase<
  typeof userSchema & typeof orgSchema & typeof teamSchema
>;

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: Database,
    private readonly commonService: CommonService,
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
    const conditions = [eq(userSchema.user.status, USER_STATUSES.Approved)];

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
      requester?.role === USER_ROLES.SuperAdmin ||
      requester?.role === USER_ROLES.SystemAdmin;

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

    if (target.role === USER_ROLES.SuperAdmin) {
      throw new ForbiddenException('Super admin accounts cannot be deleted');
    }

    if (target.role === USER_ROLES.SystemAdmin) {
      throw new ForbiddenException('System admin accounts cannot be deleted');
    }

    if (isSelf && isAdmin) {
      const otherAdmins = await this.database
        .select()
        .from(userSchema.user)
        .where(
          and(
            or(
              eq(userSchema.user.role, USER_ROLES.SuperAdmin),
              eq(userSchema.user.role, USER_ROLES.SystemAdmin),
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
        ADMIN_ACTION_LOG_ACTIONS.UserDeleted,
      );
    }

    await this.database
      .delete(userSchema.user)
      .where(eq(userSchema.user.id, targetId));

    return { success: true };
  }
}
