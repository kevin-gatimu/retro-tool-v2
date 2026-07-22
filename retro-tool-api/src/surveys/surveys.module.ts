import { Module } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysQueryService } from './surveys-query.service';
import { SurveysEmailService } from './surveys-email.service';
import { SurveysController } from './surveys.controller';
import { SurveysProjectionSyncService } from './surveys-projection-sync.service';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { ProjectionOutboxModule } from '../convex-admin/projection-outbox.module';

@Module({
  imports: [DatabaseModule, EmailModule, ProjectionOutboxModule],
  controllers: [SurveysController],
  providers: [
    SurveysService,
    SurveysQueryService,
    SurveysEmailService,
    SurveysProjectionSyncService,
  ],
  exports: [SurveysService, SurveysProjectionSyncService],
})
export class SurveysModule {}
