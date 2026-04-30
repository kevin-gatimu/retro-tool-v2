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
  private readonly logoUrl: string;

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
    const frontendUrl =
      configService.get('frontend.url', { infer: true }) ??
      'http://localhost:3000';
    this.logoUrl = `${frontendUrl.replace(/\/$/, '')}/Retro-Tool-Logo.jpg`;
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

  private logoHtml(): string {
    return `<div style="text-align:center;margin:0 0 24px 0"><img src="${this.logoUrl}" alt="Retro Tool" height="56" style="display:inline-block;height:56px;border:0" /></div>`;
  }

  buildAccountApprovedHtml(params: {
    userName: string;
    appUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  ${this.logoHtml()}
  <h2 style="color:#1e40af">You're In!</h2>
  <p>Hi ${this.esc(params.userName)},</p>
  <p>Your account has been approved. You can now sign in and start collaborating with your teams.</p>
  <p><a href="${params.appUrl}/auth/sign-in" style="display:inline-block;padding:10px 20px;background-color:#1e40af;color:white;text-decoration:none;border-radius:4px">Sign In</a></p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="color:#6b7280;font-size:12px">Retro Tool — Team Retrospectives Made Simple</p>
</body>
</html>`;
  }

  /**
   * Builds the standard invitation accept URL.
   * Token alone is enough — the API resolves org vs team from the token.
   * `email` is included so sign-in / sign-up can pre-fill the field.
   */
  private buildInviteAcceptUrl(
    appUrl: string,
    token: string,
    email: string,
  ): string {
    return `${appUrl}/auth/accept-invite?token=${encodeURIComponent(
      token,
    )}&email=${encodeURIComponent(email)}`;
  }

  private renderInviteEmail(params: {
    heading: string;
    greeting?: string;
    leadHtml: string;
    invitedEmail: string;
    acceptUrl: string;
    isExistingUser: boolean;
  }): string {
    const stepsForExisting = `
    <ol style="padding-left:20px;margin:8px 0 0 0;color:#1f2937;font-size:14px;line-height:1.6">
      <li>Click <strong>Accept Invitation</strong> below.</li>
      <li>If you're not signed in, log in with <strong>${this.esc(params.invitedEmail)}</strong> — the email this invite was sent to.</li>
      <li>You'll be taken to your new ${params.heading.toLowerCase().includes('team') ? 'team' : 'organisation'} automatically.</li>
    </ol>`;

    const stepsForNewUser = `
    <ol style="padding-left:20px;margin:8px 0 0 0;color:#1f2937;font-size:14px;line-height:1.6">
      <li>Click <strong>Accept Invitation</strong> below.</li>
      <li>Create your account using <strong>${this.esc(params.invitedEmail)}</strong> — your email will be pre-filled. <em>Use this exact address</em>, otherwise the invite cannot be accepted.</li>
      <li>Choose a password and finish sign-up.</li>
      <li>You'll be taken straight to your new ${params.heading.toLowerCase().includes('team') ? 'team' : 'organisation'}.</li>
    </ol>
    <p style="margin:12px 0 0 0;font-size:13px;color:#6b7280">
      Already have a Retro Tool account with <strong>${this.esc(params.invitedEmail)}</strong>?
      Use the same link — you'll be prompted to sign in instead.
    </p>`;

    const steps = params.isExistingUser ? stepsForExisting : stepsForNewUser;

    return `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px">
    ${this.logoHtml()}
    <h2 style="color:#1e40af;margin:0 0 16px 0">${this.esc(params.heading)}</h2>
    ${params.greeting ? `<p style="margin:0 0 12px 0">${params.greeting}</p>` : ''}
    <p style="margin:0 0 16px 0;color:#1f2937;font-size:15px;line-height:1.5">${params.leadHtml}</p>

    <div style="background:#f3f4f6;border-left:4px solid #1e40af;padding:14px 16px;border-radius:4px;margin:20px 0">
      <p style="margin:0;font-size:13px;color:#374151"><strong>Invited email:</strong> ${this.esc(params.invitedEmail)}</p>
      <p style="margin:6px 0 0 0;font-size:13px;color:#374151"><strong>This link expires in 3 days.</strong></p>
    </div>

    <p style="margin:0 0 4px 0;font-size:14px;color:#111827"><strong>What to do next:</strong></p>
    ${steps}

    <p style="margin:24px 0 8px 0;text-align:center">
      <a href="${params.acceptUrl}" style="display:inline-block;padding:12px 28px;background-color:#1e40af;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px">Accept Invitation</a>
    </p>

    <p style="margin:16px 0 0 0;font-size:12px;color:#6b7280;text-align:center">
      Trouble with the button? Copy &amp; paste this link into your browser:<br>
      <span style="word-break:break-all;color:#374151">${params.acceptUrl}</span>
    </p>

    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px 0">
    <p style="color:#6b7280;font-size:12px;margin:0;text-align:center">
      You received this email because someone invited you to collaborate on Retro Tool.<br>
      If you weren't expecting this, you can safely ignore it.
    </p>
    <p style="color:#9ca3af;font-size:11px;margin:8px 0 0 0;text-align:center">
      Retro Tool — Team Retrospectives Made Simple
    </p>
  </div>
</body>
</html>`;
  }

  buildOrgInviteHtml(params: {
    userName: string;
    invitedEmail: string;
    orgName: string;
    role: string;
    appUrl: string;
    token: string;
  }): string {
    return this.renderInviteEmail({
      heading: 'Organisation Invitation',
      greeting: `Hi ${this.esc(params.userName)},`,
      leadHtml: `You've been invited to join <strong>${this.esc(
        params.orgName,
      )}</strong> as <strong>${this.esc(params.role)}</strong>.`,
      invitedEmail: params.invitedEmail,
      acceptUrl: this.buildInviteAcceptUrl(
        params.appUrl,
        params.token,
        params.invitedEmail,
      ),
      isExistingUser: true,
    });
  }

  buildOrgExternalInviteHtml(params: {
    orgName: string;
    role: string;
    appUrl: string;
    token: string;
    invitedEmail: string;
  }): string {
    return this.renderInviteEmail({
      heading: "You've Been Invited",
      leadHtml: `You've been invited to join <strong>${this.esc(
        params.orgName,
      )}</strong> on Retro Tool as <strong>${this.esc(params.role)}</strong>.`,
      invitedEmail: params.invitedEmail,
      acceptUrl: this.buildInviteAcceptUrl(
        params.appUrl,
        params.token,
        params.invitedEmail,
      ),
      isExistingUser: false,
    });
  }

  buildTeamInviteHtml(params: {
    userName: string;
    invitedEmail: string;
    orgName: string;
    teamName: string;
    tag: string;
    appUrl: string;
    token: string;
  }): string {
    return this.renderInviteEmail({
      heading: 'Team Invitation',
      greeting: `Hi ${this.esc(params.userName)},`,
      leadHtml: `You've been invited to join the team <strong>${this.esc(
        params.teamName,
      )}</strong> in <strong>${this.esc(params.orgName)}</strong> as <strong>${this.esc(
        params.tag,
      )}</strong>.`,
      invitedEmail: params.invitedEmail,
      acceptUrl: this.buildInviteAcceptUrl(
        params.appUrl,
        params.token,
        params.invitedEmail,
      ),
      isExistingUser: true,
    });
  }

  buildTeamExternalInviteHtml(params: {
    orgName: string;
    teamName: string;
    tag: string;
    appUrl: string;
    token: string;
    invitedEmail: string;
  }): string {
    return this.renderInviteEmail({
      heading: "You've Been Invited to a Team",
      leadHtml: `You've been invited to join the team <strong>${this.esc(
        params.teamName,
      )}</strong> in <strong>${this.esc(
        params.orgName,
      )}</strong> on Retro Tool as <strong>${this.esc(params.tag)}</strong>.`,
      invitedEmail: params.invitedEmail,
      acceptUrl: this.buildInviteAcceptUrl(
        params.appUrl,
        params.token,
        params.invitedEmail,
      ),
      isExistingUser: false,
    });
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
  ${this.logoHtml()}
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
