import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as emailSchema from './schema';
import * as authSchema from '../auth/schema';
import { Config } from '../config/configuration';
import { generateId } from '../lib/utils';

type Database = NodePgDatabase<typeof emailSchema & typeof authSchema>;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly fromEmail: string;
  private readonly sandboxTo: string | null;

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
    private readonly configService: ConfigService<Config>,
  ) {
    const apiKey = configService.get('email', { infer: true })?.resendApiKey;
    this.fromEmail =
      configService.get('email', { infer: true })?.fromEmail ??
      'noreply@example.com';
    this.sandboxTo =
      configService.get('email', { infer: true })?.sandboxTo ?? null;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set — emails will be skipped');
    }
  }

  isConfigured(): boolean {
    return !!this.resend;
  }

  async send(params: {
    to: string;
    subject: string;
    html: string;
    userId: string;
    type: emailSchema.NewEmailLog['type'];
  }): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(
        `[Email] SKIP type=${params.type} to=${params.to} — Resend not configured`,
      );
      return false;
    }

    const logId = generateId();
    const recipient = this.sandboxTo ?? params.to;
    if (this.sandboxTo) {
      this.logger.warn(
        `[Email] SANDBOX_REDIRECT type=${params.type} originalTo=${params.to} redirectTo=${recipient}`,
      );
    }
    this.logger.log(
      `[Email] SENDING type=${params.type} to=${recipient} subject="${params.subject}"`,
    );

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: recipient,
        subject: params.subject,
        html: params.html,
      });

      if (error) {
        throw new Error(`Resend API error: ${error.name} — ${error.message}`);
      }

      this.logger.log(
        `[Email] DELIVERED type=${params.type} to=${recipient} resendId=${data?.id ?? 'unknown'}`,
      );

      await this.database.insert(emailSchema.emailLog).values({
        id: logId,
        userId: params.userId,
        type: params.type,
        recipientEmail: recipient,
        subject: params.subject,
        htmlBody: params.html,
        status: 'sent',
        sentAt: new Date(),
      });

      this.logger.log(`[Email] LOGGED id=${logId} status=sent`);
      return true;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[Email] FAILED type=${params.type} to=${recipient} reason="${reason}"`,
      );

      try {
        await this.database.insert(emailSchema.emailLog).values({
          id: logId,
          userId: params.userId,
          type: params.type,
          recipientEmail: recipient,
          subject: params.subject,
          htmlBody: params.html,
          status: 'failed',
          failureReason: reason,
        });
        this.logger.log(`[Email] LOGGED id=${logId} status=failed`);
      } catch (dbErr) {
        this.logger.error(
          `[Email] DB_LOG_FAILED id=${logId} type=${params.type} — ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
        );
      }

      return false;
    }
  }

  // ============================================================================
  // Email Templates
  // ============================================================================

  buildRetroReminderHtml(params: {
    userName: string;
    retroName: string;
    teamName: string;
    scheduledAt: Date;
  }): string {
    const time = params.scheduledAt.toUTCString();
    return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1e40af">Retrospective Reminder</h2>
  <p>Hi ${this.esc(params.userName)},</p>
  <p>Your retrospective <strong>${this.esc(params.retroName)}</strong> for team
     <strong>${this.esc(params.teamName)}</strong> is starting in about 1 hour.</p>
  <p><strong>Scheduled:</strong> ${time}</p>
  <p>Make sure you're ready to reflect on the sprint!</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:12px">Retro Tool — Team Retrospectives Made Simple</p>
</body>
</html>`;
  }

  buildWeeklyDigestHtml(params: {
    userName: string;
    teams: Array<{
      teamName: string;
      retroCount: number;
      totalCards: number;
      totalVotes: number;
      participationRate: number;
    }>;
  }): string {
    const rows = params.teams
      .map(
        (t) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${this.esc(t.teamName)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${t.retroCount}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${t.totalCards}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${t.totalVotes}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${Math.round(t.participationRate)}%</td>
      </tr>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1e40af">Your Weekly Digest</h2>
  <p>Hi ${this.esc(params.userName)}, here's a summary of last week's activity across your teams.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:16px">
    <thead>
      <tr style="background:#f3f4f6">
        <th style="padding:8px 12px;text-align:left">Team</th>
        <th style="padding:8px 12px;text-align:center">Retros</th>
        <th style="padding:8px 12px;text-align:center">Cards</th>
        <th style="padding:8px 12px;text-align:center">Votes</th>
        <th style="padding:8px 12px;text-align:center">Participation</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:12px">Retro Tool — Team Retrospectives Made Simple</p>
</body>
</html>`;
  }

  buildAccountApprovedHtml(params: {
    userName: string;
    appUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1e40af">You're In!</h2>
  <p>Hi ${this.esc(params.userName)},</p>
  <p>Your account has been approved. You can now sign in and start collaborating with your teams.</p>
  <p><a href="${params.appUrl}/auth/sign-in" style="display:inline-block;padding:10px 20px;background-color:#1e40af;color:white;text-decoration:none;border-radius:4px">Sign In</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:12px">Retro Tool — Team Retrospectives Made Simple</p>
</body>
</html>`;
  }

  buildOrgInviteHtml(params: {
    userName: string;
    orgName: string;
    role: string;
    appUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1e40af">Organisation Invitation</h2>
  <p>Hi ${this.esc(params.userName)},</p>
  <p>You've been added to <strong>${this.esc(params.orgName)}</strong> as <strong>${this.esc(params.role)}</strong>. Sign in to start collaborating.</p>
  <p><a href="${params.appUrl}/organizations" style="display:inline-block;padding:10px 20px;background-color:#1e40af;color:white;text-decoration:none;border-radius:4px">View Organisation</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:12px">Retro Tool — Team Retrospectives Made Simple</p>
</body>
</html>`;
  }

  buildTeamJoinRequestHtml(params: {
    adminName: string;
    requesterName: string;
    teamName: string;
    appUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1e40af">New Team Join Request</h2>
  <p>Hi ${this.esc(params.adminName)},</p>
  <p><strong>${this.esc(params.requesterName)}</strong> wants to join <strong>${this.esc(params.teamName)}</strong>. Review and approve or reject their request.</p>
  <p><a href="${params.appUrl}" style="display:inline-block;padding:10px 20px;background-color:#1e40af;color:white;text-decoration:none;border-radius:4px">Review Request</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:12px">Retro Tool — Team Retrospectives Made Simple</p>
</body>
</html>`;
  }

  buildTeamJoinApprovedHtml(params: {
    userName: string;
    teamName: string;
    teamId: string;
    appUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1e40af">Welcome to the Team</h2>
  <p>Hi ${this.esc(params.userName)},</p>
  <p>Your request to join <strong>${this.esc(params.teamName)}</strong> has been approved. You can now access the team and participate in retrospectives.</p>
  <p><a href="${params.appUrl}" style="display:inline-block;padding:10px 20px;background-color:#1e40af;color:white;text-decoration:none;border-radius:4px">View Team</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:12px">Retro Tool — Team Retrospectives Made Simple</p>
</body>
</html>`;
  }

  buildTeamJoinRejectedHtml(params: {
    userName: string;
    teamName: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#dc2626">Request Not Approved</h2>
  <p>Hi ${this.esc(params.userName)},</p>
  <p>Your request to join <strong>${this.esc(params.teamName)}</strong> was not approved at this time. You can try again later or contact the team administrator for more information.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:12px">Retro Tool — Team Retrospectives Made Simple</p>
</body>
</html>`;
  }

  buildRetroReportHtml(params: {
    recipientName: string;
    retroName: string;
    teamName: string;
    completedAt: string;
    stats: {
      participants: number;
      totalCards: number;
      discussedCards: number;
      undiscussedCards: number;
      totalVotes: number;
      actionItems: number;
    };
    columns: Array<{
      name: string;
      emoji: string;
      discussedCount: number;
      undiscussedCount: number;
      topCards: Array<{
        content: string;
        votes: number;
        comments: Array<{ content: string; authorName: string | null }>;
      }>;
    }>;
    actionItems: Array<{ title: string; assigneeName?: string }>;
  }): string {
    const statsRow = `
      <tr style="background:#f3f4f6">
        <td style="padding:12px;border:1px solid #e5e7eb"><strong>Participants</strong></td>
        <td style="padding:12px;border:1px solid #e5e7eb;text-align:center">${params.stats.participants}</td>
        <td style="padding:12px;border:1px solid #e5e7eb"><strong>Total Cards</strong></td>
        <td style="padding:12px;border:1px solid #e5e7eb;text-align:center">${params.stats.totalCards}</td>
        <td style="padding:12px;border:1px solid #e5e7eb"><strong>Discussed</strong></td>
        <td style="padding:12px;border:1px solid #e5e7eb;text-align:center">${params.stats.discussedCards}/${params.stats.totalCards}</td>
      </tr>`;

    const columnsHtml = params.columns
      .map(
        (col) => `
      <div style="margin-bottom:24px;padding:16px;background:#f9fafb;border-radius:6px;border-left:4px solid #1e40af">
        <h4 style="margin:0 0 12px;color:#1e40af">${col.emoji} ${this.esc(col.name)}</h4>
        <p style="margin:0 0 8px;font-size:12px;color:#6b7280">Discussed: <strong>${col.discussedCount}</strong> | Undiscussed: <strong>${col.undiscussedCount}</strong></p>
        <div style="margin-top:8px">
          ${col.topCards.map((card) => `<p style="margin:4px 0;font-size:13px;color:#52525b">• ${this.esc(card.content)} <span style="color:#9ca3af">(${card.votes} ${card.votes === 1 ? 'vote' : 'votes'})</span></p>`).join('')}
          ${col.topCards
            .map((card) => {
              if (card.comments.length === 0) {
                return '';
              }

              const commentsHtml = card.comments
                .map(
                  (comment) =>
                    `<li style="margin:2px 0;color:#6b7280">${this.esc(comment.authorName ?? 'Unknown')}: ${this.esc(comment.content)}</li>`,
                )
                .join('');

              return `
                <div style="margin:6px 0 10px 14px;padding-left:8px;border-left:2px solid #e5e7eb">
                  <p style="margin:0 0 4px;font-size:12px;color:#6b7280"><strong>Discussion notes</strong></p>
                  <ul style="margin:0;padding-left:16px;font-size:12px;line-height:1.4">
                    ${commentsHtml}
                  </ul>
                </div>`;
            })
            .join('')}
        </div>
      </div>`,
      )
      .join('');

    const actionItemsHtml =
      params.actionItems.length > 0
        ? `
      <h3 style="margin:24px 0 16px;color:#1e40af">Action Items</h3>
      <ol style="padding-left:20px">
        ${params.actionItems.map((item) => `<li style="margin:8px 0;color:#52525b">${this.esc(item.title)}${item.assigneeName ? ` — <strong>${this.esc(item.assigneeName)}</strong>` : ''}</li>`).join('')}
      </ol>`
        : '';

    return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1e40af">Retrospective Report</h2>
  <p>Hi ${this.esc(params.recipientName)},</p>
  <p>Here's the report from <strong>${this.esc(params.retroName)}</strong> for team <strong>${this.esc(params.teamName)}</strong> completed on ${params.completedAt}.</p>

  <h3 style="margin:24px 0 16px;color:#1e40af">Summary</h3>
  <table style="width:100%;border-collapse:collapse">
    ${statsRow}
  </table>

  <h3 style="margin:24px 0 16px;color:#1e40af">By Column</h3>
  ${columnsHtml}

  ${actionItemsHtml}

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:12px">Retro Tool — Team Retrospectives Made Simple</p>
</body>
</html>`;
  }

  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
