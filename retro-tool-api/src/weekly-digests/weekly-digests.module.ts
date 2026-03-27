import { Module } from '@nestjs/common';
import { WeeklyDigestsService } from './weekly-digests.service';
import { WeeklyDigestsController } from './weekly-digests.controller';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [DatabaseModule, EmailModule, ReportsModule],
  controllers: [WeeklyDigestsController],
  providers: [WeeklyDigestsService],
})
export class WeeklyDigestsModule {}
