import { Module } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysQueryService } from './surveys-query.service';
import { SurveysEmailService } from './surveys-email.service';
import { SurveysController } from './surveys.controller';
import { SurveysProjectionSyncService } from './surveys-projection-sync.service';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, EmailModule],
  controllers: [SurveysController],
  providers: [
    SurveysService,
    SurveysQueryService,
    SurveysEmailService,
    SurveysProjectionSyncService,
  ],
  exports: [SurveysService],
})
export class SurveysModule {}
