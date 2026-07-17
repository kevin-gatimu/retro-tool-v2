import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as teamSchema from './schema';
import * as orgSchema from '../organizations/schema';
import * as userSchema from '../auth/schema';
import { generateId } from '../lib/utils';
import { CommonService } from '../common/common.service';
import { TEAM_MEMBER_TAGS } from '../common/enums';

@Injectable()
export class TeamsService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly database: NodePgDatabase<
      typeof teamSchema & typeof orgSchema & typeof userSchema
    >,
    private readonly commonService: CommonService,
  ) {}

  // Create a new team
  async createTeam(
    userId: string,
    data: {
      name: string;
      description?: string;
      emoji?: string;
      organizationId: string;
    },
  ): Promise<typeof teamSchema.team.$inferSelect> {
    const isAdmin = await this.commonService.isSystemAdmin(userId);
    const isOrgAdmin = await this.commonService.isOrgAdmin(
      userId,
      data.organizationId,
    );

    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only system admins and organization admins can create teams',
      );
    }

    const teamId = generateId();

    // Create team
    let team: typeof teamSchema.team.$inferSelect | undefined;
    try {
      const [createdTeam] = await this.database
        .insert(teamSchema.team)
        .values({
          id: teamId,
          name: data.name,
          description: data.description,
          emoji: data.emoji || '👥',
          organizationId: data.organizationId,
        })
        .returning();
      team = createdTeam;
    } catch (error: unknown) {
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        throw new ConflictException(
          `A team named "${data.name}" already exists in this organization`,
        );
      }
      throw error;
    }

    // Add creator as team lead
    await this.database.insert(teamSchema.teamMember).values({
      id: generateId(),
      teamId: teamId,
      userId: userId,
      tag: TEAM_MEMBER_TAGS.Lead,
    });

    if (!team) {
      throw new ConflictException('Failed to create team');
    }

    return team;
  }

  /**
   * Update team
   */
  async updateTeam(
    userId: string,
    teamId: string,
    data: {
      name?: string;
      description?: string | null;
      emoji?: string;
    },
  ) {
    const canManage = await this.commonService.canManageTeam(userId, teamId);

    if (!canManage) {
      throw new ForbiddenException(
        'Only system admins, organization admins, and team leads can update teams',
      );
    }

    const [team] = await this.database
      .update(teamSchema.team)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(teamSchema.team.id, teamId))
      .returning();

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }

  /**
   * Delete team
   */
  async deleteTeam(userId: string, teamId: string) {
    const [team] = await this.database
      .select()
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .limit(1);

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isAdmin = await this.commonService.isSystemAdmin(userId);
    const isOrgAdmin = await this.commonService.isOrgAdmin(
      userId,
      team.organizationId,
    );

    if (!isAdmin && !isOrgAdmin) {
      throw new ForbiddenException(
        'Only system admins and organization admins can delete teams',
      );
    }

    const [deletedTeam] = await this.database
      .delete(teamSchema.team)
      .where(eq(teamSchema.team.id, teamId))
      .returning();

    return deletedTeam;
  }
}
