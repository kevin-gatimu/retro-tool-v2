import { Module } from '@nestjs/common';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';
import { SurveysProjectionSyncService } from './surveys-projection-sync.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SurveysController],
  providers: [SurveysService, SurveysProjectionSyncService],
  exports: [SurveysService],
})
export class SurveysModule {}
