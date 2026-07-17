import { Module } from '@nestjs/common';
import { IcebreakersService } from './icebreakers.service';
import { IcebreakersQueryService } from './icebreakers-query.service';
import { IcebreakersCreationService } from './icebreakers-creation.service';
import { IcebreakersProjectionSyncService } from './icebreakers-projection-sync.service';
import { IcebreakersController } from './icebreakers.controller';
import { IcebreakersGateway } from './icebreakers.gateway';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WsAuthModule } from '../auth/ws-auth.module';
import { StandupsModule } from '../standups/standups.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, WsAuthModule, StandupsModule],
  controllers: [IcebreakersController],
  providers: [
    IcebreakersService,
    IcebreakersQueryService,
    IcebreakersCreationService,
    IcebreakersProjectionSyncService,
    IcebreakersGateway,
  ],
})
export class IcebreakersModule {}
