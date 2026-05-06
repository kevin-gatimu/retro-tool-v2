import { Module } from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { EstimatesProjectionSyncService } from './estimates-projection-sync.service';
import { EstimatesController } from './estimates.controller';
import { EstimatesGateway } from './estimates.gateway';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, EmailModule],
  controllers: [EstimatesController],
  providers: [
    EstimatesService,
    EstimatesProjectionSyncService,
    EstimatesGateway,
  ],
})
export class EstimatesModule {}
