import { Module } from '@nestjs/common';
import { RetrosService } from './retros.service';
import { RetrosController } from './retros.controller';
import { RetrosGateway } from './retros.gateway';
import { RetrosProjectionSyncService } from './retros-projection-sync.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { WsAuthModule } from '../auth/ws-auth.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, EmailModule, WsAuthModule],
  controllers: [RetrosController],
  providers: [RetrosService, RetrosGateway, RetrosProjectionSyncService],
  exports: [RetrosGateway],
})
export class RetrosModule {}
