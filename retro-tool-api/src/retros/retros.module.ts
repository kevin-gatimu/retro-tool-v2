import { Module } from '@nestjs/common';
import { RetrosService } from './retros.service';
import { RetrosTemplatesService } from './retros-templates.service';
import { RetrosController } from './retros.controller';
import { RetrosGateway } from './retros.gateway';
import { RetrosProjectionSyncService } from './retros-projection-sync.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { WsAuthModule } from '../auth/ws-auth.module';
import { ProjectionOutboxModule } from '../convex-admin/projection-outbox.module';

@Module({
  imports: [
    DatabaseModule,
    NotificationsModule,
    EmailModule,
    WsAuthModule,
    ProjectionOutboxModule,
  ],
  controllers: [RetrosController],
  providers: [
    RetrosService,
    RetrosTemplatesService,
    RetrosGateway,
    RetrosProjectionSyncService,
  ],
  exports: [RetrosGateway, RetrosProjectionSyncService],
})
export class RetrosModule {}
