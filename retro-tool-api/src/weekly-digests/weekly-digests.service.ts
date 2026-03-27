import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as authSchema from '../auth/schema';
import * as prefSchema from '../user-preferences/schema';
import * as teamSchema from '../teams/schema';
import * as digestSchema from './schema';
import { EmailService } from '../email/email.service';
import { ReportsService } from '../reports/reports.service';
import { generateId } from '../lib/utils';
import { CreateWeeklyDigestDto, UpdateWeeklyDigestDto } from './dto';

type Database = NodePgDatabase<
  typeof authSchema &
    typeof prefSchema &
    typeof teamSchema &
    typeof digestSchema
>;

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

@Injectable()
export class WeeklyDigestsService {
  private readonly logger = new Logger(WeeklyDigestsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly emailService: EmailService,
    private readonly reportsService: ReportsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 6 * * *') // Daily at 06:00 UTC
  async sendDigests(): Promise<void> {
    if (!this.configService.get<boolean>('cronEnabled')) {
      this.logger.debug('Cron disabled — skipping weekly digests');
      return;
    }

    const today = DAY_NAMES[new Date().getDay()];
    this.logger.log(`Running weekly digest job for ${today}...`);

    // Get users with weekly digest enabled for today
    const recipients = await this.database
      .select({
        userId: prefSchema.userNotificationPreference.userId,
        userName: authSchema.user.name,
        userEmail: authSchema.user.email,
      })
      .from(prefSchema.userNotificationPreference)
      .innerJoin(
        authSchema.user,
        eq(prefSchema.userNotificationPreference.userId, authSchema.user.id),
      )
      .where(
        and(
          eq(prefSchema.userNotificationPreference.weeklyDigestEnabled, true),
          eq(prefSchema.userNotificationPreference.weeklyDigestDay, today),
        ),
      );

    if (!recipients.length) {
      this.logger.debug(`No digest recipients for ${today}`);
      return;
    }

    this.logger.log(`Sending digests to ${recipients.length} users`);

    await Promise.allSettled(
      recipients.map((recipient) =>
        this.sendDigestToUser(
          recipient.userId,
          recipient.userName,
          recipient.userEmail,
        ),
      ),
    );
  }

  private async sendDigestToUser(
    userId: string,
    userName: string,
    userEmail: string,
  ): Promise<void> {
    try {
      // Get all teams the user belongs to
      const memberships = await this.database
        .select({
          teamId: teamSchema.teamMember.teamId,
          teamName: teamSchema.team.name,
        })
        .from(teamSchema.teamMember)
        .innerJoin(
          teamSchema.team,
          eq(teamSchema.teamMember.teamId, teamSchema.team.id),
        )
        .where(eq(teamSchema.teamMember.userId, userId));

      if (!memberships.length) return;

      // Gather metrics for each team (fire-and-forget per team; skip failures)
      const teamStats = await Promise.allSettled(
        memberships.map(async (m) => {
          const metrics = await this.reportsService.getTeamMetrics(
            userId,
            m.teamId,
            'week',
          );
          return { teamName: m.teamName, ...metrics };
        }),
      );

      const successfulStats = teamStats
        .filter((r) => r.status === 'fulfilled')
        .map(
          (r) =>
            (
              r as PromiseFulfilledResult<{
                teamName: string;
                retroCount: number;
                avgParticipants: number;
                totalCards: number;
                totalVotes: number;
                actionItemsCompleted: number;
                actionItemsPending: number;
              }>
            ).value,
        );

      if (!successfulStats.length) return;

      const html = this.emailService.buildWeeklyDigestHtml({
        userName,
        teams: successfulStats.map((s) => ({
          teamName: s.teamName,
          retroCount: s.retroCount,
          totalCards: s.totalCards,
          totalVotes: s.totalVotes,
          participationRate: s.avgParticipants,
        })),
      });

      await this.emailService.send({
        to: userEmail,
        subject: 'Your Weekly Retro Digest',
        html,
        userId,
        type: 'weekly_digest',
      });
    } catch (err) {
      this.logger.error(`Failed to send digest to user ${userId}`, err);
    }
  }

  // ============================================================================
  // HTTP CRUD Methods
  // ============================================================================

  async createDigest(userId: string, dto: CreateWeeklyDigestDto) {
    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, dto.teamId),
        ),
      )
      .limit(1);

    if (!membership) throw new ForbiddenException('Not a team member');

    const id = generateId();
    const [created] = await this.database
      .insert(digestSchema.weeklyDigest)
      .values({ id, createdById: userId, ...dto })
      .returning();

    return created;
  }

  async getTeamDigests(userId: string, teamId: string) {
    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);

    if (!membership) throw new ForbiddenException('Not a team member');

    return this.database
      .select()
      .from(digestSchema.weeklyDigest)
      .where(eq(digestSchema.weeklyDigest.teamId, teamId));
  }

  async getDigest(userId: string, digestId: string) {
    const [digest] = await this.database
      .select()
      .from(digestSchema.weeklyDigest)
      .where(eq(digestSchema.weeklyDigest.id, digestId))
      .limit(1);

    if (!digest) throw new NotFoundException('Weekly digest not found');

    const [membership] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, digest.teamId),
        ),
      )
      .limit(1);

    if (!membership) throw new ForbiddenException('Not a team member');

    return digest;
  }

  async updateDigest(
    userId: string,
    digestId: string,
    dto: UpdateWeeklyDigestDto,
  ) {
    const [digest] = await this.database
      .select()
      .from(digestSchema.weeklyDigest)
      .where(eq(digestSchema.weeklyDigest.id, digestId))
      .limit(1);

    if (!digest) throw new NotFoundException('Weekly digest not found');
    if (digest.createdById !== userId) {
      throw new ForbiddenException('Only the creator can update this digest');
    }

    const [updated] = await this.database
      .update(digestSchema.weeklyDigest)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(digestSchema.weeklyDigest.id, digestId))
      .returning();

    return updated;
  }

  async deleteDigest(userId: string, digestId: string) {
    const [digest] = await this.database
      .select()
      .from(digestSchema.weeklyDigest)
      .where(eq(digestSchema.weeklyDigest.id, digestId))
      .limit(1);

    if (!digest) throw new NotFoundException('Weekly digest not found');
    if (digest.createdById !== userId) {
      throw new ForbiddenException('Only the creator can delete this digest');
    }

    await this.database
      .delete(digestSchema.weeklyDigest)
      .where(eq(digestSchema.weeklyDigest.id, digestId));
  }
}
