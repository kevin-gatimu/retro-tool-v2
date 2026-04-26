import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { RetroRemindersModule } from './retro-reminders/retro-reminders.module';
import { WeeklyDigestsModule } from './weekly-digests/weekly-digests.module';
import { ActionItemsModule } from './action-items/action-items.module';
import { TeamRolesModule } from './team-roles/team-roles.module';
import { ConvexAdminModule } from './convex-admin/convex-admin.module';
import { LastActiveInterceptor } from './common/interceptors/last-active.interceptor';
import configuration from './config/configuration';
import { HealthController } from './health.controller';
import { join } from 'path';
import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: join(__dirname, '../.env'), override: true });
// .env.local overrides .env — useful for local cloud testing without modifying .env
loadDotenv({ path: join(__dirname, '../.env.local'), override: true });

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
    RetroRemindersModule,
    WeeklyDigestsModule,
    ActionItemsModule,
    TeamRolesModule,
    ConvexAdminModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LastActiveInterceptor,
    },
  ],
})
export class AppModule {}
