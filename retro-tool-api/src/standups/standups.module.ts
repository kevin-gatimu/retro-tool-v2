import { Module } from '@nestjs/common';
import { StandupsService } from './standups.service';
import { StandupsController } from './standups.controller';
import { StandupsGateway } from './standups.gateway';
import { StandupsProjectionSyncService } from './standups-projection-sync.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { WsAuthModule } from '../auth/ws-auth.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, EmailModule, WsAuthModule],
  controllers: [StandupsController],
  providers: [StandupsService, StandupsGateway, StandupsProjectionSyncService],
  exports: [StandupsGateway],
})
export class StandupsModule {}
