import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import type { Config } from '../config/configuration';
import { DatabaseModule } from '../database/database.module';
import { createAuth } from './auth.config';
import { AuthController } from './auth.controller';
import { SignupCleanupMiddleware } from './auth-signup.middleware';
import { JwtAlignmentService } from './jwt-alignment.service';
import { OtpController } from './otp/otp.controller';
import { OtpService } from './otp/otp.service';

@Module({
  imports: [
    DatabaseModule,
    BetterAuthModule.forRootAsync({
      // isGlobal so AuthService is injectable app-wide (e.g. in WsAuthService /
      // the realtime gateways) without re-importing BetterAuthModule everywhere.
      isGlobal: true,
      useFactory: (configService: ConfigService<Config>) => ({
        auth: createAuth(configService),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, OtpController],
  providers: [OtpService, JwtAlignmentService],
  exports: [BetterAuthModule, JwtAlignmentService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SignupCleanupMiddleware)
      .forRoutes({ path: 'auth/sign-up/email', method: RequestMethod.POST });
  }
}
