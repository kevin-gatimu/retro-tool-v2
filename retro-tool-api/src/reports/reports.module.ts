import { Module } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { DashboardsController } from './dashboards.controller';
import { TeamReportAccessGuard } from './guards/team-report-access.guard';
import { OrgReportAccessGuard } from './guards/org-report-access.guard';
import { SystemReportAccessGuard } from './guards/system-report-access.guard';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardsController],
  providers: [
    DashboardsService,
    TeamReportAccessGuard,
    OrgReportAccessGuard,
    SystemReportAccessGuard,
  ],
  exports: [DashboardsService],
})
export class ReportsModule {}
