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
import { TeamsModule } from './teams/teams.module';
import { SessionsModule } from './sessions/sessions.module';
import { RetroRemindersModule } from './retro-reminders/retro-reminders.module';
import { WeeklyDigestsModule } from './weekly-digests/weekly-digests.module';
import { ActionItemsModule } from './action-items/action-items.module';
import { LastActiveInterceptor } from './common/interceptors/last-active.interceptor';
import configuration from './config/configuration';
import { HealthController } from './health.controller';
import { join } from 'path';
import { config as loadDotenv } from 'dotenv';

loadDotenv({
  path: join(__dirname, '../.env'),
  override: true,
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // Resolve .env relative to the package root for both src and dist runtime.
      envFilePath: [join(__dirname, '../.env')],
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
    EstimatesModule,
    TeamsModule,
    SessionsModule,
    RetroRemindersModule,
    WeeklyDigestsModule,
    ActionItemsModule,
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
