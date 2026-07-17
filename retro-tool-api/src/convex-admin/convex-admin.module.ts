import { Module } from '@nestjs/common';
import { ConvexAdminController } from './convex-admin.controller';
import { ConvexAdminService } from './convex-admin.service';
import { ConvexAdminCronService } from './convex-admin-cron.service';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [DatabaseModule, CommonModule, NotificationsModule, TeamsModule],
  controllers: [ConvexAdminController],
  providers: [ConvexAdminService, ConvexAdminCronService],
})
export class ConvexAdminModule {}
