import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, asc, inArray } from 'drizzle-orm';
import * as standupsSchema from './schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as orgSchema from '../organizations/schema';
import { generateId } from '../lib/utils';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateStandupDto, UpdateStandupDto } from './dtos';
import {
  NOTIFICATION_TYPES,
  ORG_MEMBER_ROLES,
  TEAM_MEMBER_TAGS,
  USER_ROLES,
  type TStandupCadence,
} from '../common/enums';
import type { Standup } from './schema';
import { parseDate } from './standups.utils';
import type { StandupDetail } from './types/index';

type Database = NodePgDatabase<
  typeof standupsSchema &
    typeof teamSchema &
    typeof authSchema &
    typeof orgSchema
>;

@Injectable()
export class StandupsService {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ==========================================================================
  // Record / permission helpers
  // ==========================================================================

  async getStandupRecord(standupId: string): Promise<Standup> {
    const [record] = await this.database
      .select()
      .from(standupsSchema.standup)
      .where(eq(standupsSchema.standup.id, standupId))
      .limit(1);

    if (!record) throw new NotFoundException('Standup not found');
    return record;
  }

  async assertTeamMember(teamId: string, userId: string): Promise<void> {
    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException(
        'You must be a team member to access this standup',
      );
    }
  }

  /**
   * Team-level "can manage standups" check for actions that have no standup id
   * yet (i.e. creating one): allow team-leads of the team, org owners/admins of
   * the team's org, and system/super-admins. Plain team members are rejected —
   * creating a standup is a manager action (mirrors the per-standup
   * {@link canManageStandup} role set, minus the creator branch which can't
   * apply before the standup exists).
   */
  async assertCanCreateStandup(teamId: string, userId: string): Promise<void> {
    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);
    const role = fullUser?.role;
    if (role === USER_ROLES.SuperAdmin || role === USER_ROLES.SystemAdmin) {
      return;
    }

    const [team] = await this.database
      .select({ orgId: teamSchema.team.organizationId })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    if (team?.orgId) {
      const [orgMembership] = await this.database
        .select({ role: orgSchema.organizationMember.role })
        .from(orgSchema.organizationMember)
        .where(
          and(
            eq(orgSchema.organizationMember.organizationId, team.orgId),
            eq(orgSchema.organizationMember.userId, userId),
          ),
        )
        .limit(1);
      if (
        orgMembership?.role === ORG_MEMBER_ROLES.Owner ||
        orgMembership?.role === ORG_MEMBER_ROLES.Admin
      ) {
        return;
      }
    }

    const [teamMembership] = await this.database
      .select({ tag: teamSchema.teamMember.tag })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    if (teamMembership?.tag !== TEAM_MEMBER_TAGS.Lead) {
      throw new ForbiddenException(
        'Only team leads, org admins, and system admins can create standups',
      );
    }
  }

  async canManageStandup(standupId: string, userId: string): Promise<boolean> {
    const [row] = await this.database
      .select({
        createdById: standupsSchema.standup.createdById,
        teamId: standupsSchema.standup.teamId,
        orgId: teamSchema.team.organizationId,
      })
      .from(standupsSchema.standup)
      .leftJoin(
        teamSchema.team,
        eq(standupsSchema.standup.teamId, teamSchema.team.id),
      )
      .where(eq(standupsSchema.standup.id, standupId))
      .limit(1);

    if (!row) throw new NotFoundException('Standup not found');

    if (row.createdById === userId) return true;

    const [fullUser] = await this.database
      .select({ role: authSchema.user.role })
      .from(authSchema.user)
      .where(eq(authSchema.user.id, userId))
      .limit(1);

    const role = fullUser?.role;

    if (role === USER_ROLES.SuperAdmin || role === USER_ROLES.SystemAdmin) {
      return true;
    }

    if (row.orgId) {
      const [orgMembership] = await this.database
        .select({ role: orgSchema.organizationMember.role })
        .from(orgSchema.organizationMember)
        .where(
          and(
            eq(orgSchema.organizationMember.organizationId, row.orgId),
            eq(orgSchema.organizationMember.userId, userId),
          ),
        )
        .limit(1);

      if (
        orgMembership?.role === ORG_MEMBER_ROLES.Owner ||
        orgMembership?.role === ORG_MEMBER_ROLES.Admin
      ) {
        return true;
      }
    }

    const [teamMembership] = await this.database
      .select({ tag: teamSchema.teamMember.tag })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.teamId, row.teamId),
          eq(teamSchema.teamMember.userId, userId),
        ),
      )
      .limit(1);

    return teamMembership?.tag === TEAM_MEMBER_TAGS.Lead;
  }

  // ==========================================================================
  // Standup CRUD
  // ==========================================================================

  async createStandup(
    userId: string,
    data: CreateStandupDto,
  ): Promise<{ id: string }> {
    await this.assertCanCreateStandup(data.teamId, userId);

    const id = generateId();

    await this.database.insert(standupsSchema.standup).values({
      id,
      name: data.name,
      teamId: data.teamId,
      cadence: data.cadence as TStandupCadence,
      scheduleDays: data.scheduleDays.join(','),
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      createdById: userId,
    });

    await this.database.insert(standupsSchema.standupQuestion).values(
      data.questions.map((question, index) => ({
        id: generateId(),
        standupId: id,
        prompt: question.prompt,
        color: question.color ?? null,
        order: index,
        isRequired: question.isRequired ?? true,
      })),
    );

    void this.notifyTeamOfStandupCreated(id, data.name, data.teamId).catch(
      () => undefined,
    );

    return { id };
  }

  async getStandup(userId: string, standupId: string): Promise<StandupDetail> {
    const record = await this.getStandupRecord(standupId);
    await this.assertTeamMember(record.teamId, userId);

    const [teamRow] = await this.database
      .select({ id: teamSchema.team.id, name: teamSchema.team.name })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, record.teamId))
      .limit(1);

    const questions = await this.database
      .select()
      .from(standupsSchema.standupQuestion)
      .where(eq(standupsSchema.standupQuestion.standupId, standupId))
      .orderBy(asc(standupsSchema.standupQuestion.order));

    const canManage = await this.canManageStandup(standupId, userId);

    const skippedRows = await this.database
      .select({ skipDate: standupsSchema.standupSkippedDay.skipDate })
      .from(standupsSchema.standupSkippedDay)
      .where(eq(standupsSchema.standupSkippedDay.standupId, standupId));

    return {
      ...record,
      isCreator: record.createdById === userId,
      canManage,
      currentUserId: userId,
      team: teamRow ?? { id: record.teamId, name: 'Unknown team' },
      questions: questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        color: question.color,
        order: question.order,
        isRequired: question.isRequired,
      })),
      skippedDays: skippedRows.map((row) => row.skipDate),
    };
  }

  async updateStandup(
    userId: string,
    standupId: string,
    data: UpdateStandupDto,
  ): Promise<{ id: string }> {
    const record = await this.getStandupRecord(standupId);

    const canManage = await this.canManageStandup(standupId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can update this standup',
      );
    }

    await this.database
      .update(standupsSchema.standup)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.cadence !== undefined
          ? { cadence: data.cadence as TStandupCadence }
          : {}),
        ...(data.scheduleDays !== undefined
          ? { scheduleDays: data.scheduleDays.join(',') }
          : {}),
        ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
        ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(standupsSchema.standup.id, standupId));

    if (data.questions) {
      const existing = await this.database
        .select({ id: standupsSchema.standupQuestion.id })
        .from(standupsSchema.standupQuestion)
        .where(eq(standupsSchema.standupQuestion.standupId, standupId));

      const keptIds = new Set(
        data.questions
          .map((question) => question.id)
          .filter((questionId): questionId is string => Boolean(questionId)),
      );

      const removedIds = existing
        .map((question) => question.id)
        .filter((questionId) => !keptIds.has(questionId));

      if (removedIds.length > 0) {
        await this.database
          .delete(standupsSchema.standupQuestion)
          .where(inArray(standupsSchema.standupQuestion.id, removedIds));
      }

      for (const [index, question] of data.questions.entries()) {
        if (question.id && existing.some((row) => row.id === question.id)) {
          await this.database
            .update(standupsSchema.standupQuestion)
            .set({
              prompt: question.prompt,
              color: question.color ?? null,
              order: index,
              isRequired: question.isRequired ?? true,
            })
            .where(eq(standupsSchema.standupQuestion.id, question.id));
        } else {
          await this.database.insert(standupsSchema.standupQuestion).values({
            id: generateId(),
            standupId,
            prompt: question.prompt,
            color: question.color ?? null,
            order: index,
            isRequired: question.isRequired ?? true,
          });
        }
      }
    }

    return { id: record.id };
  }

  async deleteStandup(
    userId: string,
    standupId: string,
  ): Promise<{ success: boolean }> {
    await this.getStandupRecord(standupId);

    const canManage = await this.canManageStandup(standupId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can delete this standup',
      );
    }

    await this.database
      .delete(standupsSchema.standup)
      .where(eq(standupsSchema.standup.id, standupId));

    return { success: true };
  }

  // ==========================================================================
  // Skipped days
  // ==========================================================================

  async skipDay(
    userId: string,
    standupId: string,
    dateStr: string,
  ): Promise<{ success: boolean }> {
    parseDate(dateStr);
    await this.getStandupRecord(standupId);

    const canManage = await this.canManageStandup(standupId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can skip a standup day',
      );
    }

    await this.database
      .insert(standupsSchema.standupSkippedDay)
      .values({
        id: generateId(),
        standupId,
        skipDate: dateStr,
        createdById: userId,
      })
      .onConflictDoNothing();

    return { success: true };
  }

  async unskipDay(
    userId: string,
    standupId: string,
    dateStr: string,
  ): Promise<{ success: boolean }> {
    parseDate(dateStr);
    await this.getStandupRecord(standupId);

    const canManage = await this.canManageStandup(standupId, userId);
    if (!canManage) {
      throw new ForbiddenException(
        'Only the creator, a team lead, or an admin can restore a skipped day',
      );
    }

    await this.database
      .delete(standupsSchema.standupSkippedDay)
      .where(
        and(
          eq(standupsSchema.standupSkippedDay.standupId, standupId),
          eq(standupsSchema.standupSkippedDay.skipDate, dateStr),
        ),
      );

    return { success: true };
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  private async notifyTeamOfStandupCreated(
    standupId: string,
    standupName: string,
    teamId: string,
  ): Promise<void> {
    const members = await this.database
      .select({ userId: teamSchema.teamMember.userId })
      .from(teamSchema.teamMember)
      .where(eq(teamSchema.teamMember.teamId, teamId));

    await Promise.all(
      members.map((member) =>
        this.notificationsService.createAndEmit({
          userId: member.userId,
          type: NOTIFICATION_TYPES.StandupCreated,
          title: 'New standup',
          message: `A new standup "${standupName}" has been set up for your team.`,
          link: `/standups/${standupId}`,
        }),
      ),
    );
  }
}
