import { Resend } from 'resend';

export interface EmailService {
  sendPasswordResetEmail(params: {
    to: string;
    name: string;
    resetUrl: string;
  }): Promise<void>;

  sendVerificationEmail(params: {
    to: string;
    name: string;
    verificationUrl: string;
  }): Promise<void>;
}

/**
 * Creates an EmailService backed by Resend.
 * Falls back to console logging when no API key is provided (development).
 */
export function createEmailService(
  apiKey: string | undefined,
  fromEmail: string,
): EmailService {
  if (!apiKey) {
    return {
      sendPasswordResetEmail({ to, resetUrl }) {
        console.log(
          `[Email] Password reset for ${to} — no RESEND_API_KEY set. Reset URL: ${resetUrl}`,
        );
        return Promise.resolve();
      },
      sendVerificationEmail({ to, verificationUrl }) {
        console.log(
          `[Email] Email verification for ${to} — no RESEND_API_KEY set. Verification URL: ${verificationUrl}`,
        );
        return Promise.resolve();
      },
    };
  }

  const resend = new Resend(apiKey);

  return {
    async sendPasswordResetEmail({ to, name, resetUrl }) {
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: 'Reset your password',
        html: passwordResetHtml({ name, resetUrl }),
      });
    },
    async sendVerificationEmail({ to, name, verificationUrl }) {
      await resend.emails.send({
        from: fromEmail,
        to,
        subject: 'Verify your email address',
        html: emailVerificationHtml({ name, verificationUrl }),
      });
    },
  };
}

function passwordResetHtml({
  name,
  resetUrl,
}: {
  name: string;
  resetUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:32px 40px;">
              <p style="margin:0;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:-0.3px;">Retro Tool</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#18181b;letter-spacing:-0.3px;">Reset your password</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#52525b;">
                Hi ${name},
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#52525b;">
                We received a request to reset the password for your account. Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background-color:#18181b;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:6px;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
                If you didn't request a password reset, you can safely ignore this email — your password won't change.
              </p>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
                Or copy and paste this link into your browser:<br />
                <a href="${resetUrl}" style="color:#52525b;word-break:break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                This email was sent by Retro Tool. If you have questions, contact your administrator.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function emailVerificationHtml({
  name,
  verificationUrl,
}: {
  name: string;
  verificationUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email address</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:32px 40px;">
              <p style="margin:0;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:-0.3px;">Retro Tool</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#18181b;letter-spacing:-0.3px;">Confirm your email</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#52525b;">
                Hi ${name},
              </p>
              <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#52525b;">
                Click the button below to verify your email address. This link expires in <strong>24 hours</strong>.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:6px;background-color:#18181b;">
                    <a href="${verificationUrl}"
                       style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:6px;">
                      Verify email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
                If you didn't sign up for this account, you can safely ignore this email.
              </p>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#a1a1aa;">
                Or copy and paste this link into your browser:<br />
                <a href="${verificationUrl}" style="color:#52525b;word-break:break-all;">${verificationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                This email was sent by Retro Tool. If you have questions, contact your administrator.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
