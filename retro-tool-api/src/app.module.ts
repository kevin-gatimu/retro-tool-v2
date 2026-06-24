import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UserPreferencesModule } from './user-preferences/user-preferences.module';
import { RetrosModule } from './retros/retros.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EstimatesModule } from './estimates/estimates.module';
import { EstimateTemplatesModule } from './estimate-templates/estimate-templates.module';
import { TeamsModule } from './teams/teams.module';
import { SessionsModule } from './sessions/sessions.module';
import { ActionItemsModule } from './action-items/action-items.module';
import { TeamRolesModule } from './team-roles/team-roles.module';
import { ConvexAdminModule } from './convex-admin/convex-admin.module';
import { InvitationsModule } from './invitations/invitations.module';
import { LastActiveInterceptor } from './common/interceptors/last-active.interceptor';
import configuration from './config/configuration';
import { HealthController } from './health.controller';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Resolve .env relative to the package root for both src and dist runtime.
      envFilePath: [
        join(__dirname, '../.env.local'),
        join(__dirname, '../.env'),
      ],
    }),
    ScheduleModule.forRoot(),
    // Global per-IP rate limiting (~100 requests / minute). Better Auth applies
    // its own stricter limits to /api/auth/* on top of this default tier.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    DatabaseModule,
    UsersModule,
    OrganizationsModule,
    UserPreferencesModule,
    RetrosModule,
    ReportsModule,
    NotificationsModule,
    EstimateTemplatesModule,
    EstimatesModule,
    TeamsModule,
    SessionsModule,
    ActionItemsModule,
    TeamRolesModule,
    ConvexAdminModule,
    InvitationsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LastActiveInterceptor,
    },
  ],
})
export class AppModule {}
