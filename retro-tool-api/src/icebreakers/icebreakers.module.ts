import { Module } from '@nestjs/common';
import { IcebreakersService } from './icebreakers.service';
import { IcebreakersQueryService } from './icebreakers-query.service';
import { IcebreakersCreationService } from './icebreakers-creation.service';
import { IcebreakersProjectionSyncService } from './icebreakers-projection-sync.service';
import { IcebreakersController } from './icebreakers.controller';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StandupsModule } from '../standups/standups.module';
import { ProjectionOutboxModule } from '../convex-admin/projection-outbox.module';

@Module({
  imports: [
    DatabaseModule,
    NotificationsModule,
    StandupsModule,
    ProjectionOutboxModule,
  ],
  controllers: [IcebreakersController],
  providers: [
    IcebreakersService,
    IcebreakersQueryService,
    IcebreakersCreationService,
    IcebreakersProjectionSyncService,
  ],
  exports: [IcebreakersProjectionSyncService],
})
export class IcebreakersModule {}
