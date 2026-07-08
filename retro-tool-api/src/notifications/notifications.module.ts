import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { PushService } from './push.service';
import { NotificationsProjectionSyncService } from './notifications-projection-sync.service';
import { DatabaseModule } from '../database/database.module';
import { ConfigModule } from '@nestjs/config';
import { WsAuthModule } from '../auth/ws-auth.module';

@Module({
  imports: [DatabaseModule, ConfigModule, WsAuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    PushService,
    NotificationsProjectionSyncService,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    PushService,
    NotificationsProjectionSyncService,
  ],
})
export class NotificationsModule {}
