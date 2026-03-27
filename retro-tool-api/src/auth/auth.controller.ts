import {
  Controller,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  /**
   * Sign in with email and password
   * POST /auth/sign-in/email
   */
  @Post('sign-in/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        password: {
          type: 'string',
          format: 'password',
          example: 'password123',
        },
        rememberMe: {
          type: 'boolean',
          default: true,
          description:
            'Keep session alive after browser close. Defaults to true.',
        },
        callbackURL: {
          type: 'string',
          example: 'http://localhost:5173/dashboard',
          description: 'URL to redirect to after sign in.',
        },
      },
      required: ['email', 'password'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully signed in',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  signInEmail() {
    // Handled by better-auth
    return;
  }

  /**
   * Sign up with email and password
   * POST /auth/sign-up/email
   */
  @Post('sign-up/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign up with email and password' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        password: {
          type: 'string',
          format: 'password',
          example: 'password123',
        },
        name: { type: 'string', example: 'John Doe' },
        image: {
          type: 'string',
          example: 'https://example.com/avatar.png',
          description: 'Optional profile image URL.',
        },
        callbackURL: {
          type: 'string',
          example: 'http://localhost:5173/dashboard',
          description: 'URL to redirect to after sign up.',
        },
      },
      required: ['email', 'password', 'name'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully signed up',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  signUpEmail() {
    // Handled by better-auth
    return;
  }

  /**
   * Sign out
   * POST /auth/sign-out
   */
  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign out current user' })
  @ApiResponse({ status: 200, description: 'Successfully signed out' })
  @UseGuards(AuthGuard)
  @ApiBearerAuth('session')
  signOut() {
    // Handled by better-auth
    return;
  }

  /**
   * Get current session
   * GET /auth/session
   */
  @Get('session')
  @ApiOperation({ summary: 'Get current session' })
  @ApiResponse({
    status: 200,
    description: 'Returns current session',
    schema: {
      type: 'object',
      properties: {
        session: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No active session' })
  getSession() {
    // Handled by better-auth
    return;
  }

  /**
   * Forgot password
   * POST /auth/forgot-password
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        redirectTo: {
          type: 'string',
          example: 'http://localhost:5173/reset-password',
          description:
            'Frontend URL where the reset token will be appended as ?token=...',
        },
      },
      required: ['email'],
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  forgotPassword() {
    // Handled by better-auth
    return;
  }

  /**
   * Reset password
   * POST /auth/reset-password
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Reset token from email' },
        newPassword: {
          type: 'string',
          format: 'password',
          example: 'newpassword123',
        },
      },
      required: ['token', 'newPassword'],
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  resetPassword() {
    // Handled by better-auth
    return;
  }

  /**
   * Change password
   * POST /auth/change-password
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (authenticated)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        currentPassword: { type: 'string', format: 'password' },
        newPassword: {
          type: 'string',
          format: 'password',
          example: 'newpassword123',
        },
        revokeOtherSessions: {
          type: 'boolean',
          default: false,
          description:
            'Revoke all other active sessions after password change.',
        },
      },
      required: ['currentPassword', 'newPassword'],
    },
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  changePassword() {
    // Handled by better-auth
    return;
  }

  /**
   * Change email
   * POST /auth/change-email
   */
  @Post('change-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change email (authenticated)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newEmail: {
          type: 'string',
          format: 'email',
          example: 'newemail@example.com',
        },
        password: { type: 'string', format: 'password' },
      },
      required: ['newEmail', 'password'],
    },
  })
  @ApiResponse({ status: 200, description: 'Email change initiated' })
  changeEmail() {
    // Handled by better-auth
    return;
  }

  /**
   * Delete user account
   * POST /auth/delete-user
   */
  @Post('delete-user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user account (authenticated)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        password: { type: 'string', format: 'password' },
      },
      required: ['password'],
    },
  })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Password incorrect' })
  deleteUser() {
    // Handled by better-auth
    return;
  }

  /**
   * Google OAuth sign in
   * GET /auth/sign-in/google
   */
  @Get('sign-in/google')
  @ApiOperation({ summary: 'Sign in with Google OAuth' })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth' })
  signInGoogle() {
    // Handled by better-auth
    return;
  }

  /**
   * Google OAuth callback
   * GET /auth/callback/google
   */
  @Get('callback/google')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with session',
  })
  googleCallback() {
    // Handled by better-auth
    return;
  }

  /**
   * Microsoft OAuth sign in
   * GET /auth/sign-in/microsoft
   */
  @Get('sign-in/microsoft')
  @ApiOperation({ summary: 'Sign in with Microsoft (Entra ID)' })
  @ApiResponse({ status: 302, description: 'Redirects to Microsoft login' })
  signInMicrosoft() {
    // Handled by better-auth
    return;
  }

  /**
   * Microsoft OAuth callback
   * GET /auth/callback/microsoft
   */
  @Get('callback/microsoft')
  @ApiOperation({ summary: 'Microsoft OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with session',
  })
  microsoftCallback() {
    // Handled by better-auth
    return;
  }
}
