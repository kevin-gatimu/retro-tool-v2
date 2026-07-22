import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushService } from './push.service';
import { NotificationsProjectionSyncService } from './notifications-projection-sync.service';
import { DatabaseModule } from '../database/database.module';
import { ConfigModule } from '@nestjs/config';
import { ProjectionOutboxModule } from '../convex-admin/projection-outbox.module';

@Module({
  imports: [DatabaseModule, ConfigModule, ProjectionOutboxModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushService,
    NotificationsProjectionSyncService,
  ],
  exports: [
    NotificationsService,
    PushService,
    NotificationsProjectionSyncService,
  ],
})
export class NotificationsModule {}
