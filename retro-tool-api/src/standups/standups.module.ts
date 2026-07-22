import { Module } from '@nestjs/common';
import { StandupsService } from './standups.service';
import { StandupsQueryService } from './standups-query.service';
import { StandupsEntriesService } from './standups-entries.service';
import { StandupsSubmissionsService } from './standups-submissions.service';
import { StandupsReportService } from './standups-report.service';
import { StandupsController } from './standups.controller';
import { StandupsProjectionSyncService } from './standups-projection-sync.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { ProjectionOutboxModule } from '../convex-admin/projection-outbox.module';

@Module({
  imports: [
    DatabaseModule,
    NotificationsModule,
    EmailModule,
    ProjectionOutboxModule,
  ],
  controllers: [StandupsController],
  providers: [
    StandupsService,
    StandupsQueryService,
    StandupsEntriesService,
    StandupsSubmissionsService,
    StandupsReportService,
    StandupsProjectionSyncService,
  ],
  exports: [StandupsProjectionSyncService],
})
export class StandupsModule {}
