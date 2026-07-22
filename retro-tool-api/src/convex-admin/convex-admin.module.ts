import { Module } from '@nestjs/common';
import { ConvexAdminController } from './convex-admin.controller';
import { ConvexAdminService } from './convex-admin.service';
import { ConvexAdminCronService } from './convex-admin-cron.service';
import { ProjectionOutboxModule } from './projection-outbox.module';
import { ProjectionReconciliationService } from './projection-reconciliation.service';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeamsModule } from '../teams/teams.module';
import { RetrosModule } from '../retros/retros.module';
import { EstimatesModule } from '../estimates/estimates.module';
import { IcebreakersModule } from '../icebreakers/icebreakers.module';
import { StandupsModule } from '../standups/standups.module';
import { PollsModule } from '../polls/polls.module';
import { SurveysModule } from '../surveys/surveys.module';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    ProjectionOutboxModule,
    NotificationsModule,
    TeamsModule,
    RetrosModule,
    EstimatesModule,
    IcebreakersModule,
    StandupsModule,
    PollsModule,
    SurveysModule,
  ],
  controllers: [ConvexAdminController],
  providers: [
    ConvexAdminService,
    ConvexAdminCronService,
    ProjectionReconciliationService,
  ],
})
export class ConvexAdminModule {}
