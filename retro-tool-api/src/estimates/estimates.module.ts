import { Module } from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { EstimatesReportService } from './estimates-report.service';
import { EstimatesProjectionSyncService } from './estimates-projection-sync.service';
import { EstimatesController } from './estimates.controller';
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
  controllers: [EstimatesController],
  providers: [
    EstimatesService,
    EstimatesReportService,
    EstimatesProjectionSyncService,
  ],
  exports: [EstimatesProjectionSyncService],
})
export class EstimatesModule {}
