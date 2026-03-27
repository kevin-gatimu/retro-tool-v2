import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { Config } from '../config/configuration';
import { createAuth } from './auth.config';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      useFactory: (configService: ConfigService<Config>) => ({
        auth: createAuth(configService),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  exports: [BetterAuthModule],
})
export class AuthModule {}
