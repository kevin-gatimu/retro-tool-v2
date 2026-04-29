import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service';
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
  providers: [TeamsService, TeamInvitationsService],
  exports: [TeamsService, TeamInvitationsService],
})
export class TeamsModule {}
