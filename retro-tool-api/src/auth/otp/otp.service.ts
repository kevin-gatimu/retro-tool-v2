import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { APIError } from 'better-auth/api';
import type { Auth } from '../auth.config';
import type {
  RequestPasswordResetOtpDto,
  ResetPasswordOtpDto,
  SendOtpDto,
  SignInOtpDto,
  VerifyEmailOtpDto,
} from './dto';

/**
 * Better Auth's `APIError` carries a runtime `body` ({ code, message }) that its
 * exported type doesn't cleanly surface. Read it via an `unknown`-typed view so
 * we never intersect with `APIError`'s own (unresolved) `body` typing.
 */
function readErrorBody(
  err: unknown,
): { code?: string; message?: string } | undefined {
  if (typeof err !== 'object' || err === null || !('body' in err)) {
    return undefined;
  }
  const { body } = err as { body: unknown }; // 'body' in err checked just above
  return typeof body === 'object' && body !== null
    ? (body as { code?: string; message?: string }) // shape guarded on this line
    : undefined;
}

/**
 * Thin server-side wrapper around Better Auth's emailOTP endpoints. The UI
 * never calls the Better Auth plugin routes directly — it calls our /api/otp/*
 * controller, which delegates to the injected auth instance (`auth.api.*`).
 * This keeps every send/verify on the server (rate-limit, logging, status).
 */
@Injectable()
export class OtpService {
  constructor(private readonly authService: AuthService<Auth>) {}

  private get api() {
    return this.authService.api;
  }

  /** Translate Better Auth APIError into clean Nest HTTP errors. */
  private rethrow(err: unknown): never {
    if (err instanceof APIError) {
      // APIError carries `body` ({ code, message }) at runtime; the exported
      // type doesn't surface it cleanly, so read it via readErrorBody.
      const body = readErrorBody(err);
      const code = body?.code;
      const message = body?.message || 'OTP request failed';
      if (code === 'TOO_MANY_ATTEMPTS') {
        throw new HttpException(
          'Too many attempts. Request a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new BadRequestException(message);
    }
    throw err;
  }

  async send(dto: SendOtpDto): Promise<{ success: true }> {
    try {
      await this.api.sendVerificationOTP({ body: dto });
      return { success: true };
    } catch (err) {
      this.rethrow(err);
    }
  }

  /**
   * Passwordless sign-in. Forwards the caller's request headers so Better Auth
   * records the client IP + user-agent on the session, and returns the response
   * body plus Set-Cookie / set-auth-token headers for the controller to relay.
   */
  async signIn(dto: SignInOtpDto, requestHeaders?: Record<string, string>) {
    try {
      const { headers, response } = await this.api.signInEmailOTP({
        body: dto,
        headers: requestHeaders,
        returnHeaders: true,
      });
      return { headers, response };
    } catch (err) {
      this.rethrow(err);
    }
  }

  async verifyEmail(dto: VerifyEmailOtpDto) {
    try {
      return await this.api.verifyEmailOTP({ body: dto });
    } catch (err) {
      this.rethrow(err);
    }
  }

  async requestPasswordReset(
    dto: RequestPasswordResetOtpDto,
  ): Promise<{ success: true }> {
    try {
      await this.api.requestPasswordResetEmailOTP({ body: dto });
      return { success: true };
    } catch (err) {
      this.rethrow(err);
    }
  }

  async resetPassword(dto: ResetPasswordOtpDto): Promise<{ success: true }> {
    try {
      await this.api.resetPasswordEmailOTP({ body: dto });
      return { success: true };
    } catch (err) {
      this.rethrow(err);
    }
  }
}
