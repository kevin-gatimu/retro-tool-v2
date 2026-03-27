import { Module } from '@nestjs/common';
import { EstimatesService } from './estimates.service';
import { EstimatesProjectionSyncService } from './estimates-projection-sync.service';
import { EstimatesController } from './estimates.controller';
import { EstimatesGateway } from './estimates.gateway';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  controllers: [EstimatesController],
  providers: [
    EstimatesService,
    EstimatesProjectionSyncService,
    EstimatesGateway,
  ],
})
export class EstimatesModule {}
