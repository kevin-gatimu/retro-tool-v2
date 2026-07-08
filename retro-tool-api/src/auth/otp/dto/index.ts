import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

// ── Zod schemas (validated by ZodValidationPipe) ───────────────────────────

export const sendOtpSchema = z.object({
  email: z.string().email(),
  type: z.enum(['sign-in', 'email-verification', 'forget-password']),
});

export const signInOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(1),
});

export const verifyEmailOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(1),
});

export const requestPasswordResetOtpSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(1),
  password: z.string().min(6),
});

export type SendOtpDto = z.infer<typeof sendOtpSchema>;
export type SignInOtpDto = z.infer<typeof signInOtpSchema>;
export type VerifyEmailOtpDto = z.infer<typeof verifyEmailOtpSchema>;
export type RequestPasswordResetOtpDto = z.infer<
  typeof requestPasswordResetOtpSchema
>;
export type ResetPasswordOtpDto = z.infer<typeof resetPasswordOtpSchema>;

// ── Swagger DTO classes ─────────────────────────────────────────────────────

export class SendOtpDtoClass {
  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({ enum: ['sign-in', 'email-verification', 'forget-password'] })
  type: 'sign-in' | 'email-verification' | 'forget-password';
}

export class SignInOtpDtoClass {
  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({ description: 'The 6-digit code sent to the email' })
  otp: string;
}

export class VerifyEmailOtpDtoClass {
  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  otp: string;
}

export class RequestPasswordResetOtpDtoClass {
  @ApiProperty({ format: 'email' })
  email: string;
}

export class ResetPasswordOtpDtoClass {
  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty()
  otp: string;

  @ApiProperty({ minLength: 6 })
  password: string;
}
