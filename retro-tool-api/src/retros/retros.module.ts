import { Module } from '@nestjs/common';
import { RetrosService } from './retros.service';
import { RetrosTemplatesService } from './retros-templates.service';
import { RetrosController } from './retros.controller';
import { RetrosProjectionSyncService } from './retros-projection-sync.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { ProjectionOutboxModule } from '../convex-admin/projection-outbox.module';

@Module({
  imports: [
    DatabaseModule,
    NotificationsModule,
    EmailModule,
    ProjectionOutboxModule,
  ],
  controllers: [RetrosController],
  providers: [
    RetrosService,
    RetrosTemplatesService,
    RetrosProjectionSyncService,
  ],
  exports: [RetrosProjectionSyncService],
})
export class RetrosModule {}
