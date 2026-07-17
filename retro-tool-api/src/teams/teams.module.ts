import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsQueryService } from './teams-query.service';
import { TeamsMembersService } from './teams-members.service';
import { TeamsMembersProjectionSyncService } from './teams-members-projection-sync.service';
import { TeamsJoinRequestsService } from './teams-join-requests.service';
import { TeamsController } from './teams.controller';
import { TeamInvitationsController } from './invitations/invitations.controller';
import { TeamInvitationsService } from './invitations/invitations.service';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [DatabaseModule, CommonModule, NotificationsModule, EmailModule],
  controllers: [TeamsController, TeamInvitationsController],
  providers: [
    TeamsService,
    TeamsQueryService,
    TeamsMembersService,
    TeamsMembersProjectionSyncService,
    TeamsJoinRequestsService,
    TeamInvitationsService,
  ],
  exports: [
    TeamsService,
    TeamInvitationsService,
    TeamsMembersProjectionSyncService,
  ],
})
export class TeamsModule {}
