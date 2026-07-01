import { Module } from '@nestjs/common';
import { IcebreakersService } from './icebreakers.service';
import { IcebreakersProjectionSyncService } from './icebreakers-projection-sync.service';
import { IcebreakersController } from './icebreakers.controller';
import { IcebreakersGateway } from './icebreakers.gateway';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WsAuthModule } from '../auth/ws-auth.module';

@Module({
  imports: [DatabaseModule, NotificationsModule, WsAuthModule],
  controllers: [IcebreakersController],
  providers: [
    IcebreakersService,
    IcebreakersProjectionSyncService,
    IcebreakersGateway,
  ],
})
export class IcebreakersModule {}
