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
import { eq, and, isNull, lte, gte } from 'drizzle-orm';
import * as retroSchema from '../retros/schema';
import * as teamSchema from '../teams/schema';
import * as authSchema from '../auth/schema';
import * as prefSchema from '../user-preferences/schema';
import * as reminderSchema from './schema';
import { EmailService } from '../email/email.service';
import { generateId } from '../lib/utils';
import { CreateRetroReminderDto, UpdateRetroReminderDto } from './dto';
import { RETRO_STATUSES } from '../common/enums';

type Database = NodePgDatabase<
  typeof retroSchema &
    typeof teamSchema &
    typeof authSchema &
    typeof prefSchema &
    typeof reminderSchema
>;

@Injectable()
export class RetroRemindersService {
  private readonly logger = new Logger(RetroRemindersService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('0 * * * *') // Every hour on the hour
  async sendReminders(): Promise<void> {
    if (!this.configService.get<boolean>('cronEnabled')) {
      this.logger.debug('Cron disabled — skipping retro reminders');
      return;
    }

    this.logger.log('Running retro reminder job...');

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find retros scheduled to start within the next hour,
    // that haven't been reminded yet and haven't started
    const upcomingRetros = await this.database
      .select({
        id: retroSchema.retrospective.id,
        name: retroSchema.retrospective.name,
        teamId: retroSchema.retrospective.teamId,
        scheduledAt: retroSchema.retrospective.scheduledAt,
      })
      .from(retroSchema.retrospective)
      .where(
        and(
          eq(retroSchema.retrospective.status, RETRO_STATUSES.Draft),
          isNull(retroSchema.retrospective.reminderSentAt),
          gte(retroSchema.retrospective.scheduledAt, now),
          lte(retroSchema.retrospective.scheduledAt, oneHourFromNow),
        ),
      );

    if (!upcomingRetros.length) {
      this.logger.debug('No upcoming retros to remind about');
      return;
    }

    this.logger.log(`Found ${upcomingRetros.length} retros to remind about`);

    for (const retro of upcomingRetros) {
      try {
        await this.sendRetroReminders(retro);
        // Mark retro as reminded
        await this.database
          .update(retroSchema.retrospective)
          .set({ reminderSentAt: now })
          .where(eq(retroSchema.retrospective.id, retro.id));
      } catch (err) {
        this.logger.error(
          `Failed to send reminders for retro ${retro.id}`,
          err,
        );
      }
    }
  }

  private async sendRetroReminders(retro: {
    id: string;
    name: string;
    teamId: string;
    scheduledAt: Date | null;
  }): Promise<void> {
    // Get team members with retro reminders enabled
    const eligibleMembers = await this.database
      .select({
        userId: teamSchema.teamMember.userId,
        userName: authSchema.user.name,
        userEmail: authSchema.user.email,
      })
      .from(teamSchema.teamMember)
      .innerJoin(
        authSchema.user,
        eq(teamSchema.teamMember.userId, authSchema.user.id),
      )
      .leftJoin(
        prefSchema.userNotificationPreference,
        eq(
          prefSchema.userNotificationPreference.userId,
          teamSchema.teamMember.userId,
        ),
      )
      .where(
        and(
          eq(teamSchema.teamMember.teamId, retro.teamId),
          eq(
            prefSchema.userNotificationPreference.retrospectiveRemindersEnabled,
            true,
          ),
        ),
      );

    const [team] = await this.database
      .select({ name: teamSchema.team.name })
      .from(teamSchema.team)
      .where(eq(teamSchema.team.id, retro.teamId))
      .limit(1);

    const teamName = team?.name ?? 'your team';

    this.logger.log(
      `Sending retro reminder for "${retro.name}" to ${eligibleMembers.length} members`,
    );

    await Promise.allSettled(
      eligibleMembers.map((member) => {
        const html = this.emailService.buildRetroReminderHtml({
          userName: member.userName,
          retroName: retro.name,
          teamName,
          scheduledAt: retro.scheduledAt ?? new Date(),
        });

        return this.emailService.send({
          to: member.userEmail,
          subject: `Reminder: "${retro.name}" starts soon`,
          html,
          userId: member.userId,
          type: 'retro_reminder',
        });
      }),
    );
  }

  // ============================================================================
  // HTTP CRUD Methods
  // ============================================================================

  async createReminder(userId: string, dto: CreateRetroReminderDto) {
    const isMember = await this.isMember(userId, dto.teamId);
    if (!isMember) throw new ForbiddenException('Not a team member');

    const id = generateId();
    const [created] = await this.database
      .insert(reminderSchema.retroReminder)
      .values({
        id,
        teamId: dto.teamId,
        retroId: dto.retroId,
        type: dto.type,
        schedule: dto.schedule,
        message: dto.message,
        createdById: userId,
      })
      .returning();

    return created;
  }

  async getTeamReminders(userId: string, teamId: string) {
    const isMember = await this.isMember(userId, teamId);
    if (!isMember) throw new ForbiddenException('Not a team member');

    return this.database
      .select()
      .from(reminderSchema.retroReminder)
      .where(eq(reminderSchema.retroReminder.teamId, teamId));
  }

  async getReminder(userId: string, reminderId: string) {
    const [reminder] = await this.database
      .select()
      .from(reminderSchema.retroReminder)
      .where(eq(reminderSchema.retroReminder.id, reminderId))
      .limit(1);

    if (!reminder) throw new NotFoundException('Reminder not found');

    const isMember = await this.isMember(userId, reminder.teamId);
    if (!isMember) throw new ForbiddenException('Not a team member');

    return reminder;
  }

  async updateReminder(
    userId: string,
    reminderId: string,
    dto: UpdateRetroReminderDto,
  ) {
    const [reminder] = await this.database
      .select()
      .from(reminderSchema.retroReminder)
      .where(eq(reminderSchema.retroReminder.id, reminderId))
      .limit(1);

    if (!reminder) throw new NotFoundException('Reminder not found');
    if (reminder.createdById !== userId) {
      throw new ForbiddenException('Only the creator can update this reminder');
    }

    const [updated] = await this.database
      .update(reminderSchema.retroReminder)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(reminderSchema.retroReminder.id, reminderId))
      .returning();

    return updated;
  }

  async deleteReminder(userId: string, reminderId: string) {
    const [reminder] = await this.database
      .select()
      .from(reminderSchema.retroReminder)
      .where(eq(reminderSchema.retroReminder.id, reminderId))
      .limit(1);

    if (!reminder) throw new NotFoundException('Reminder not found');
    if (reminder.createdById !== userId) {
      throw new ForbiddenException('Only the creator can delete this reminder');
    }

    await this.database
      .delete(reminderSchema.retroReminder)
      .where(eq(reminderSchema.retroReminder.id, reminderId));
  }

  private async isMember(userId: string, teamId: string): Promise<boolean> {
    const [row] = await this.database
      .select({ id: teamSchema.teamMember.id })
      .from(teamSchema.teamMember)
      .where(
        and(
          eq(teamSchema.teamMember.userId, userId),
          eq(teamSchema.teamMember.teamId, teamId),
        ),
      )
      .limit(1);
    return !!row;
  }
}
