import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OtpService } from './otp.service';
import {
  RequestPasswordResetOtpDtoClass,
  ResetPasswordOtpDtoClass,
  SendOtpDtoClass,
  SignInOtpDtoClass,
  VerifyEmailOtpDtoClass,
  requestPasswordResetOtpSchema,
  resetPasswordOtpSchema,
  sendOtpSchema,
  signInOtpSchema,
  verifyEmailOtpSchema,
  type RequestPasswordResetOtpDto,
  type ResetPasswordOtpDto,
  type SendOtpDto,
  type SignInOtpDto,
  type VerifyEmailOtpDto,
} from './dto';

@ApiTags('auth')
@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('send')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an email OTP (sign-in / verify / reset)' })
  @ApiBody({ type: SendOtpDtoClass })
  @ApiResponse({ status: 200, description: 'OTP sent (if the email exists)' })
  @UsePipes(new ZodValidationPipe(sendOtpSchema))
  async send(@Body() body: SendOtpDto) {
    return this.otpService.send(body);
  }

  @Post('sign-in')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Passwordless sign-in with an email OTP' })
  @ApiBody({ type: SignInOtpDtoClass })
  @ApiResponse({ status: 200, description: 'Signed in; session cookie set' })
  @UsePipes(new ZodValidationPipe(signInOtpSchema))
  async signIn(
    @Body() body: SignInOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Forward the incoming request headers so Better Auth captures the client
    // IP + user-agent onto the new session row.
    const { headers, response } = await this.otpService.signIn(
      body,
      req.headers as Record<string, string>,
    );
    // Propagate Better Auth's Set-Cookie + set-auth-token to the client so the
    // UI's existing cookie/bearer capture keeps working.
    const setCookies = headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      res.append('set-cookie', cookie);
    }
    const authToken = headers.get('set-auth-token');
    if (authToken) {
      res.setHeader('set-auth-token', authToken);
    }
    return response;
  }

  @Post('verify-email')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address with an OTP' })
  @ApiBody({ type: VerifyEmailOtpDtoClass })
  @UsePipes(new ZodValidationPipe(verifyEmailOtpSchema))
  async verifyEmail(@Body() body: VerifyEmailOtpDto) {
    return this.otpService.verifyEmail(body);
  }

  @Post('reset-password/send')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a password-reset OTP' })
  @ApiBody({ type: RequestPasswordResetOtpDtoClass })
  @UsePipes(new ZodValidationPipe(requestPasswordResetOtpSchema))
  async requestPasswordReset(@Body() body: RequestPasswordResetOtpDto) {
    return this.otpService.requestPasswordReset(body);
  }

  @Post('reset-password')
  @AllowAnonymous()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using an OTP' })
  @ApiBody({ type: ResetPasswordOtpDtoClass })
  @UsePipes(new ZodValidationPipe(resetPasswordOtpSchema))
  async resetPassword(@Body() body: ResetPasswordOtpDto) {
    return this.otpService.resetPassword(body);
  }
}
